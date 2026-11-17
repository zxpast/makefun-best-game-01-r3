// Browser boot for ROADWARD: canvas setup, input, the fixed-step loop and
// the shot/auto modes. All game rules live in sim.mjs; this file only
// turns mouse and keyboard into sim calls and hands the state to render.mjs.

import { newGame, step, startDraft, extendDraft, confirmDraft, cancelDraft, buildTower, upgradeTower, sellTower, startNight, chooseBoon, rerollBoons, continueEndless, cellCenter, COLS, ROWS, CELL, FIELD_X, FIELD_Y } from './sim.mjs';
import { DIFFICULTIES, gateRow, beaconRow } from './levels.mjs';
import { TOWER_TYPES } from './towers.mjs';
import { drawGame, W, H, SIDEBAR_X, SHOP_Y, SHOP_ROW_H } from './render.mjs';
import { play, setMuted, isMuted, startMusic } from './audio.mjs';
import { createBot } from './autopilot.mjs';
import { makeRng } from './rng.mjs';
import { buildShotScene } from './scenes.mjs';

const params = new URLSearchParams(location.search);
const seedParam = parseInt(params.get('seed') || '', 10);
const seed = Number.isFinite(seedParam) ? seedParam : (Date.now() % 100000) + 1;
const autoMode = params.get('auto') === '1';
const shotMode = params.get('shot') || null;

const canvas = document.getElementById('game');
canvas.width = W;
canvas.height = H;
const ctx = canvas.getContext('2d');

const rngStars = makeRng(1234);
const stars = [];
for (let i = 0; i < 90; i++) {
  stars.push({
    x: rngStars.range(0, W),
    y: rngStars.range(0, H),
    tw: rngStars.range(0.5, 2),
    ph: rngStars.range(0, Math.PI * 2),
  });
}

const DIFF_LIST = [
  { key: 'ember', name: 'Ember', blurb: 'Gentle first road' },
  { key: 'blaze', name: 'Blaze', blurb: 'The road as meant' },
  { key: 'inferno', name: 'Inferno', blurb: 'Dark comes hungry' },
];

let difficulty = 'blaze';
let state = newGame(seed, DIFFICULTIES[difficulty]);
let mode = 'title'; // title | game
let bot = autoMode ? createBot(state) : null;
let selected = null; // { kind: 'build', type } | { kind: 'tower', id }
let hover = null; // { kind: 'build', type, cell } | null
let drawing = false;
let speed = 1;
let paused = false;
let best = 0;
try {
  best = parseInt(localStorage.getItem('roadward-best') || '0', 10) || 0;
} catch (e) { /* storage unavailable */ }

function view() {
  return {
    state,
    selected,
    hover,
    mode,
    muted: isMuted(),
    speed,
    paused,
    stars,
    gateRow: gateRow(state.night),
    beaconRow: beaconRow(state.night),
    difficulties: DIFF_LIST,
    difficulty,
    best,
  };
}

function toCell(ev) {
  const rect = canvas.getBoundingClientRect();
  const x = ((ev.clientX - rect.left) / rect.width) * W;
  const y = ((ev.clientY - rect.top) / rect.height) * H;
  return {
    x, y,
    cx: Math.floor((x - FIELD_X) / CELL),
    cy: Math.floor((y - FIELD_Y) / CELL),
    inField: x >= FIELD_X && x < FIELD_X + COLS * CELL && y >= FIELD_Y && y < FIELD_Y + ROWS * CELL,
  };
}

function shopRowAt(y) {
  if (y < SHOP_Y) return -1;
  const i = Math.floor((y - SHOP_Y) / SHOP_ROW_H);
  return i >= 0 && i < TOWER_TYPES.length ? i : -1;
}

function startGame() {
  state = newGame(seed, DIFFICULTIES[difficulty]);
  bot = autoMode ? createBot(state) : null;
  selected = null;
  hover = null;
  mode = 'game';
  startMusic();
}

function restart() {
  startGame();
}

function selectBuild(type) {
  selected = { kind: 'build', type };
}

function clickTowerAt(cx, cy) {
  const t = state.towers.find((tw) => tw.cx === cx && tw.cy === cy);
  if (t) {
    selected = { kind: 'tower', id: t.id };
    return true;
  }
  return false;
}

canvas.addEventListener('mousedown', (ev) => {
  const p = toCell(ev);
  if (mode === 'title') {
    // Difficulty buttons.
    const bw = 220;
    const gap = 20;
    const x0 = (W - (bw * 3 + gap * 2)) / 2;
    for (let i = 0; i < 3; i++) {
      const x = x0 + i * (bw + gap);
      if (p.x >= x && p.x <= x + bw && p.y >= 380 && p.y <= 476) {
        difficulty = DIFF_LIST[i].key;
        return;
      }
    }
    startGame();
    return;
  }
  if (state.phase === 'boon') {
    const cw = 300;
    const gap = 24;
    const total = cw * 3 + gap * 2;
    const x0 = (W - total) / 2;
    for (let i = 0; i < state.boonChoices.length; i++) {
      const x = x0 + i * (cw + gap);
      if (p.x >= x && p.x <= x + cw && p.y >= 240 && p.y <= 460) {
        chooseBoon(state, state.boonChoices[i].id);
        return;
      }
    }
    return;
  }
  if (state.phase === 'won' || state.phase === 'lost') return;
  // Sidebar: shop rows.
  if (p.x >= SIDEBAR_X) {
    const row = shopRowAt(p.y);
    if (row >= 0) {
      selectBuild(TOWER_TYPES[row].key);
      return;
    }
    // Upgrade / sell buttons.
    if (selected && selected.kind === 'tower') {
      const y = 620;
      if (p.y >= y && p.y <= y + 34) {
        if (p.x >= SIDEBAR_X + 10 && p.x <= SIDEBAR_X + 122) upgradeTower(state, selected.id);
        if (p.x >= SIDEBAR_X + 132 && p.x <= SIDEBAR_X + 244) {
          sellTower(state, selected.id);
          selected = null;
        }
      }
      return;
    }
    // Start night button.
    if (state.phase === 'draw' && p.y >= 668 && p.y <= 706 && p.x >= SIDEBAR_X + 10) {
      startNight(state);
    }
    return;
  }
  if (!p.inField) return;
  if (state.phase === 'draw' && p.cx === 0 && p.cy === gateRow(state.night)) {
    drawing = true;
    startDraft(state, p.cx, p.cy);
    return;
  }
  if (selected && selected.kind === 'build') {
    if (buildTower(state, selected.type, p.cx, p.cy)) {
      // Keep the type selected so the player can plant a row of them.
    }
    return;
  }
  clickTowerAt(p.cx, p.cy);
});

canvas.addEventListener('mousemove', (ev) => {
  const p = toCell(ev);
  hover = null;
  if (mode === 'game' && selected && selected.kind === 'build' && p.inField) {
    hover = { kind: 'build', type: selected.type, cell: { x: p.cx, y: p.cy } };
  }
  if (drawing && p.inField) {
    extendDraft(state, p.cx, p.cy);
  }
});

window.addEventListener('mouseup', () => {
  if (drawing) {
    drawing = false;
    if (!confirmDraft(state)) cancelDraft(state);
  }
});

window.addEventListener('keydown', (ev) => {
  if (ev.repeat) return;
  const k = ev.key.toLowerCase();
  if (mode === 'title') {
    if (k === '1') difficulty = 'ember';
    else if (k === '2') difficulty = 'blaze';
    else if (k === '3') difficulty = 'inferno';
    else if (k === 'enter' || k === ' ') startGame();
    return;
  }
  if (k === 'm') {
    setMuted(!isMuted());
    return;
  }
  if (k === 'p') {
    paused = !paused;
    return;
  }
  if (k === 'f') {
    speed = speed === 1 ? 2 : 1;
    return;
  }
  if (state.phase === 'boon') {
    if (k >= '1' && k <= '3') {
      const b = state.boonChoices[parseInt(k, 10) - 1];
      if (b) chooseBoon(state, b.id);
    } else if (k === 'r') {
      rerollBoons(state);
    }
    return;
  }
  if (k === 'r') {
    restart();
    return;
  }
  if (k === 'escape') {
    selected = null;
    cancelDraft(state);
    return;
  }
  if (state.phase === 'won' && k === 'e') {
    continueEndless(state);
    return;
  }
  if (state.phase !== 'draw' && state.phase !== 'fight') return;
  if (k >= '1' && k <= '6') {
    selectBuild(TOWER_TYPES[parseInt(k, 10) - 1].key);
    return;
  }
  if (k === ' ') {
    ev.preventDefault();
    if (state.phase === 'draw') startNight(state);
    return;
  }
  if (selected && selected.kind === 'tower') {
    if (k === 'u') upgradeTower(state, selected.id);
    if (k === 'x') {
      sellTower(state, selected.id);
      selected = null;
    }
  }
});

// ---- loop -----------------------------------------------------------------

let last = performance.now();
let acc = 0;
let lastShootSound = 0;

function frame(now) {
  const dtMs = Math.min(100, now - last);
  last = now;
  if (!paused && mode === 'game') {
    acc += (dtMs / 1000) * speed;
    const stepDt = 1 / 60;
    let guard = 0;
    while (acc >= stepDt && guard++ < 8) {
      if (bot) bot.update();
      step(state, stepDt);
      acc -= stepDt;
    }
    // Sounds from the sim's event queue.
    for (const e of state.events) {
      if (e === 'shoot') {
        if (now - lastShootSound > 90) {
          lastShootSound = now;
          play('shoot');
        }
      } else {
        play(e);
      }
    }
    state.events.length = 0;
    if (state.stats.nightsCleared > best) {
      best = state.stats.nightsCleared;
      try {
        localStorage.setItem('roadward-best', String(best));
      } catch (e) { /* ignore */ }
    }
  }
  drawGame(ctx, view());
  requestAnimationFrame(frame);
}

if (shotMode) {
  // Deterministic single-frame render for screenshots. The scene builder
  // plays the real game to the requested moment, then we draw it once.
  const scene = buildShotScene(shotMode, seed);
  state = scene.state;
  mode = scene.mode;
  difficulty = scene.difficulty;
  best = scene.best;
  selected = scene.selected || null;
  drawGame(ctx, view());
  window.__shotReady = true;
} else {
  requestAnimationFrame(frame);
}
