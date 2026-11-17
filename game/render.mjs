// Canvas drawing for ROADWARD. Every shape is a plain canvas primitive
// (rects, arcs, lines, text) so the same code renders in the browser and in
// the Node screenshot renderer. No gradients, no shadows: glow comes from
// layered translucent circles.

import { COLS, ROWS, CELL, FIELD_X, FIELD_Y, cellCenter } from './sim.mjs';
import { TOWER_TYPES, towerStats, upgradeCost, sellValue } from './towers.mjs';

export const W = 1280;
export const H = 720;
export const SIDEBAR_X = 1020;
export const SHOP_Y = 208;
export const SHOP_ROW_H = 56;

const SKY = '#0e1428';
const GROUND = '#1a2138';
const GRID_LINE = 'rgba(255,255,255,0.05)';
const ROAD = '#6b5a3e';
const ROAD_EDGE = '#4a3e2c';
const AMBER = '#ffd166';
const INK = '#f2ead8';

function jitter(t, amp) {
  return Math.sin(t * 127.1) * amp;
}

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arc(x + w - r, y + r, r, -Math.PI / 2, 0);
  ctx.lineTo(x + w, y + h - r);
  ctx.arc(x + w - r, y + h - r, r, 0, Math.PI / 2);
  ctx.lineTo(x + r, y + h);
  ctx.arc(x + r, y + h - r, r, Math.PI / 2, Math.PI);
  ctx.lineTo(x, y + r);
  ctx.arc(x + r, y + r, r, Math.PI, Math.PI * 1.5);
  ctx.closePath();
}

function text(ctx, s, x, y, size, color, align = 'left', bold = true) {
  ctx.fillStyle = color;
  ctx.font = (bold ? 'bold ' : '') + size + 'px sans-serif';
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(s, x, y);
}

function bar(ctx, x, y, w, h, frac, fill, back) {
  ctx.fillStyle = back;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, Math.max(0, Math.min(1, frac)) * w, h);
}

function drawTowerGlyph(ctx, def, x, y, size, level, flash) {
  const s = size;
  ctx.save();
  ctx.translate(x, y);
  if (flash > 0) {
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.75, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.fillStyle = def.dark;
  ctx.fillRect(-s * 0.32, -s * 0.1, s * 0.64, s * 0.55);
  ctx.fillStyle = def.color;
  if (def.key === 'ember') {
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.62);
    ctx.lineTo(s * 0.3, -s * 0.05);
    ctx.lineTo(-s * 0.3, -s * 0.05);
    ctx.closePath();
    ctx.fill();
  } else if (def.key === 'sniper') {
    ctx.fillRect(-s * 0.08, -s * 0.75, s * 0.16, s * 0.8);
    ctx.beginPath();
    ctx.arc(0, -s * 0.75, s * 0.16, 0, Math.PI * 2);
    ctx.fill();
  } else if (def.key === 'frost') {
    ctx.strokeStyle = def.color;
    ctx.lineWidth = 3;
    for (let i = 0; i < 3; i++) {
      const a = (i * Math.PI) / 3;
      ctx.beginPath();
      ctx.moveTo(-Math.cos(a) * s * 0.45, -Math.sin(a) * s * 0.45);
      ctx.lineTo(Math.cos(a) * s * 0.45, Math.sin(a) * s * 0.45);
      ctx.stroke();
    }
  } else if (def.key === 'brazier') {
    ctx.beginPath();
    ctx.arc(0, -s * 0.1, s * 0.34, 0, Math.PI);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.7);
    ctx.lineTo(s * 0.2, -s * 0.2);
    ctx.lineTo(-s * 0.2, -s * 0.2);
    ctx.closePath();
    ctx.fill();
  } else if (def.key === 'bell') {
    ctx.beginPath();
    ctx.arc(0, -s * 0.15, s * 0.36, Math.PI, 0);
    ctx.closePath();
    ctx.fill();
    ctx.fillRect(-s * 0.36, -s * 0.15, s * 0.72, s * 0.12);
    ctx.beginPath();
    ctx.arc(0, s * 0.05, s * 0.1, 0, Math.PI * 2);
    ctx.fill();
  } else if (def.key === 'cannon') {
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = def.dark;
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.18, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  // level pips
  for (let i = 0; i < level; i++) {
    ctx.fillStyle = AMBER;
    ctx.beginPath();
    ctx.arc(x - (level - 1) * 5 + i * 10, y + s * 0.55, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawEnemy(ctx, e, t) {
  const r = e.radius * CELL;
  ctx.save();
  ctx.translate(e.x, e.y);
  if (e.flash > 0) {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }
  if (e.isBoss) {
    ctx.fillStyle = e.dark;
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i - 2) * 0.5;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * r * 0.7, Math.sin(a) * r * 0.7 - r * 0.4);
      ctx.lineTo(Math.cos(a + 0.22) * r * 1.15, Math.sin(a + 0.22) * r * 1.15 - r * 0.7);
      ctx.lineTo(Math.cos(a + 0.44) * r * 0.7, Math.sin(a + 0.44) * r * 0.7 - r * 0.4);
      ctx.closePath();
      ctx.fill();
    }
  }
  ctx.fillStyle = e.dark;
  ctx.beginPath();
  ctx.arc(0, 2, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = e.color;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.85, 0, Math.PI * 2);
  ctx.fill();
  // eyes
  ctx.fillStyle = '#14101e';
  const bob = Math.sin(t * 6 + e.id) * 1.5;
  ctx.beginPath();
  ctx.arc(-r * 0.3, -r * 0.15 + bob, r * 0.14, 0, Math.PI * 2);
  ctx.arc(r * 0.3, -r * 0.15 + bob, r * 0.14, 0, Math.PI * 2);
  ctx.fill();
  if (!e.slowImmune && e.slowUntil > 0) {
    ctx.strokeStyle = 'rgba(127,231,255,0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, r + 3, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
  // hp bar
  if (e.hp < e.maxHp) {
    const w = Math.max(28, r * 1.8);
    bar(ctx, e.x - w / 2, e.y - r - 12, w, 5, e.hp / e.maxHp, e.isBoss ? '#ff4d6d' : '#7ee787', '#00000088');
  }
}

export function drawGame(ctx, view) {
  const { state, selected, hover, mode } = view;
  const t = state.time;
  ctx.save();
  if (state.shake > 0.5) {
    ctx.translate(jitter(t, state.shake), jitter(t + 40, state.shake));
  }

  // sky and ground
  ctx.fillStyle = SKY;
  ctx.fillRect(-20, -20, W + 40, H + 40);
  ctx.fillStyle = GROUND;
  ctx.fillRect(FIELD_X - 10, FIELD_Y - 10, COLS * CELL + 20, ROWS * CELL + 20);
  // stars
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  for (const s of view.stars) {
    ctx.globalAlpha = 0.25 + 0.35 * Math.abs(Math.sin(t * s.tw + s.ph));
    ctx.fillRect(s.x, s.y, 2, 2);
  }
  ctx.globalAlpha = 1;
  // grid
  ctx.strokeStyle = GRID_LINE;
  ctx.lineWidth = 1;
  for (let x = 0; x <= COLS; x++) {
    ctx.beginPath();
    ctx.moveTo(FIELD_X + x * CELL, FIELD_Y);
    ctx.lineTo(FIELD_X + x * CELL, FIELD_Y + ROWS * CELL);
    ctx.stroke();
  }
  for (let y = 0; y <= ROWS; y++) {
    ctx.beginPath();
    ctx.moveTo(FIELD_X, FIELD_Y + y * CELL);
    ctx.lineTo(FIELD_X + COLS * CELL, FIELD_Y + y * CELL);
    ctx.stroke();
  }

  // road
  for (const c of state.path) {
    const px = FIELD_X + c.x * CELL;
    const py = FIELD_Y + c.y * CELL;
    ctx.fillStyle = ROAD_EDGE;
    ctx.fillRect(px + 2, py + 2, CELL - 4, CELL - 4);
    ctx.fillStyle = ROAD;
    ctx.fillRect(px + 6, py + 6, CELL - 12, CELL - 12);
    ctx.fillStyle = 'rgba(255,220,150,0.12)';
    ctx.fillRect(px + CELL / 2 - 2, py + 8, 4, CELL - 16);
  }
  // draft road preview
  if (state.draft.length > 0) {
    for (const c of state.draft) {
      const px = FIELD_X + c.x * CELL;
      const py = FIELD_Y + c.y * CELL;
      ctx.fillStyle = 'rgba(255,209,102,0.45)';
      ctx.fillRect(px + 6, py + 6, CELL - 12, CELL - 12);
    }
  }

  // entry gate
  const gate = cellCenter(0, view.gateRow);
  ctx.fillStyle = '#0a0d1a';
  ctx.fillRect(FIELD_X - 34, gate.y - 34, 34, 68);
  ctx.fillStyle = '#3a2f22';
  ctx.fillRect(FIELD_X - 6, gate.y - 34, 6, 68);
  text(ctx, 'GATE', FIELD_X - 17, gate.y, 11, '#8a7a5a', 'center');

  // beacon (the light to defend)
  const beacon = cellCenter(COLS - 1, view.beaconRow);
  const flick = 1 + 0.08 * Math.sin(t * 7) + 0.05 * Math.sin(t * 13);
  for (let i = 3; i >= 1; i--) {
    ctx.globalAlpha = 0.08 * i;
    ctx.fillStyle = '#ffd166';
    ctx.beginPath();
    ctx.arc(beacon.x, beacon.y, 46 * i * flick, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#3a2f22';
  ctx.fillRect(beacon.x - 14, beacon.y - 6, 28, 34);
  ctx.fillStyle = AMBER;
  ctx.beginPath();
  ctx.arc(beacon.x, beacon.y - 10, 13 * flick, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff3c4';
  ctx.beginPath();
  ctx.arc(beacon.x, beacon.y - 10, 6 * flick, 0, Math.PI * 2);
  ctx.fill();

  // selected tower range
  if (selected && selected.kind === 'tower') {
    const tw = state.towers.find((x) => x.id === selected.id);
    if (tw) {
      const stats = towerStats(tw.def, tw.level);
      const p = cellCenter(tw.cx, tw.cy);
      ctx.globalAlpha = 0.12;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(p.x, p.y, stats.range * (1 + state.mods.range) * CELL, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  // towers
  for (const tw of state.towers) {
    const p = cellCenter(tw.cx, tw.cy);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(p.x - 22, p.y + 16, 44, 8);
    drawTowerGlyph(ctx, tw.def, p.x, p.y, 40, tw.level, tw.flash);
    if (tw.hp < tw.maxHp) {
      bar(ctx, p.x - 20, p.y - 30, 40, 4, tw.hp / tw.maxHp, '#ff7a59', '#00000088');
    }
  }

  // hover ghost
  if (hover && hover.kind === 'build' && hover.cell) {
    const def = TOWER_TYPES.find((x) => x.key === hover.type);
    const p = cellCenter(hover.cell.x, hover.cell.y);
    ctx.globalAlpha = 0.55;
    drawTowerGlyph(ctx, def, p.x, p.y, 40, 1, 0);
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(p.x, p.y, towerStats(def, 1).range * CELL, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // enemies
  for (const e of state.enemies) drawEnemy(ctx, e, t);

  // projectiles
  for (const p of state.projectiles) {
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.kind === 'cannon' ? 7 : 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.35;
    ctx.beginPath();
    ctx.arc(p.x, p.y, (p.kind === 'cannon' ? 12 : 7), 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // particles
  for (const p of state.particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  }
  ctx.globalAlpha = 1;

  // floaters
  for (const f of state.floaters) {
    ctx.globalAlpha = Math.max(0, f.life / f.maxLife);
    text(ctx, f.text, f.x, f.y, 15, f.color, 'center');
  }
  ctx.globalAlpha = 1;

  ctx.restore();

  drawSidebar(ctx, view);
  drawTopbar(ctx, view);

  // banner
  if (state.bannerTimer > 0 && state.banner) {
    ctx.globalAlpha = Math.min(1, state.bannerTimer);
    text(ctx, state.banner, W / 2, 96, 26, '#ffe9a8', 'center');
    ctx.globalAlpha = 1;
  }

  if (mode === 'title') drawTitle(ctx, view);
  if (state.phase === 'boon') drawBoons(ctx, view);
  if (state.phase === 'won') drawEnd(ctx, view, true);
  if (state.phase === 'lost') drawEnd(ctx, view, false);
  if (view.paused) {
    ctx.fillStyle = 'rgba(10,13,26,0.6)';
    ctx.fillRect(0, 0, W, H);
    text(ctx, 'PAUSED', W / 2, H / 2, 44, INK, 'center');
    text(ctx, 'P to resume', W / 2, H / 2 + 44, 18, '#9aa3c0', 'center');
  }
}

function drawTopbar(ctx, view) {
  const { state } = view;
  ctx.fillStyle = '#0a0d1a';
  ctx.fillRect(0, 0, W, 48);
  text(ctx, 'ROADWARD', 24, 25, 22, AMBER);
  const nightLabel = state.endless
    ? 'Endless night ' + state.night
    : 'Night ' + state.night + ' / 10';
  text(ctx, nightLabel, 300, 25, 18, INK);
  text(ctx, 'Embers  ' + Math.floor(state.embers), 520, 25, 18, '#ffb347');
  const left = state.phase === 'fight' ? state.spawnQueue.length + state.enemies.length : state.phase === 'won' || state.phase === 'lost' ? 0 : state.spawnTotal;
  text(ctx, 'Foes left  ' + left, 700, 25, 18, '#ff8a7a');
  text(ctx, (view.muted ? 'M sound off' : 'M sound on') + ' · F ' + view.speed + 'x · P pause', 940, 25, 14, '#9aa3c0');
}

function drawSidebar(ctx, view) {
  const { state, selected } = view;
  const x = SIDEBAR_X;
  ctx.fillStyle = '#10152a';
  ctx.fillRect(x, 48, W - x, H - 48);
  ctx.fillStyle = '#232a4a';
  ctx.fillRect(x, 48, 2, H - 48);

  text(ctx, 'THE BEACON', x + 16, 74, 15, '#9aa3c0');
  bar(ctx, x + 16, 88, 224, 16, state.beaconHp / state.beaconMax, '#ffd166', '#2a2118');
  text(ctx, Math.ceil(state.beaconHp) + ' / ' + state.beaconMax + ' light', x + 16, 116, 14, INK);

  text(ctx, 'LANTERNS', x + 16, 156, 13, '#9aa3c0');
  text(ctx, 'Keys 1-6 to build', x + 16, 176, 12, '#6b7390');

  for (let i = 0; i < TOWER_TYPES.length; i++) {
    const def = TOWER_TYPES[i];
    const y = SHOP_Y + i * SHOP_ROW_H;
    const isSel = selected && selected.kind === 'build' && selected.type === def.key;
    ctx.fillStyle = isSel ? '#2c355e' : '#171d36';
    rr(ctx, x + 10, y, 238, 50, 6);
    ctx.fill();
    if (isSel) {
      ctx.strokeStyle = AMBER;
      ctx.lineWidth = 2;
      rr(ctx, x + 10, y, 238, 50, 6);
      ctx.stroke();
    }
    drawTowerGlyph(ctx, def, x + 34, y + 25, 30, 1, 0);
    text(ctx, def.short, x + 58, y + 17, 15, INK);
    text(ctx, def.desc, x + 58, y + 36, 11, '#9aa3c0');
    text(ctx, def.cost + ' ◆', x + 240, y + 17, 15, state.embers >= def.cost ? '#ffb347' : '#7a5a3a', 'right');
    text(ctx, '[' + def.hotkey + ']', x + 240, y + 36, 11, '#6b7390', 'right');
  }

  // selected tower panel
  if (selected && selected.kind === 'tower') {
    const tw = state.towers.find((t) => t.id === selected.id);
    if (tw) {
      const y = 566;
      text(ctx, tw.def.name + '  Lv ' + tw.level, x + 16, y, 16, INK);
      const stats = towerStats(tw.def, tw.level);
      const dmgLine = tw.def.key === 'bell'
        ? 'Buffs neighbours +' + Math.round(stats.buff * 100) + '%'
        : 'Damage ' + Math.round(stats.damage) + ' · Range ' + stats.range.toFixed(1);
      text(ctx, dmgLine, x + 16, y + 22, 12, '#9aa3c0');
      text(ctx, 'Kills ' + (tw.kills || 0) + ' · HP ' + Math.ceil(tw.hp) + '/' + tw.maxHp, x + 16, y + 40, 12, '#9aa3c0');
      // upgrade button
      const upCost = tw.level < 3 ? upgradeCost(tw.def, tw.level) : null;
      ctx.fillStyle = upCost && state.embers >= upCost ? '#3a5a2e' : '#222a44';
      rr(ctx, x + 10, y + 54, 112, 34, 6);
      ctx.fill();
      text(ctx, upCost ? 'Up ' + upCost + '◆ [U]' : 'Max level', x + 66, y + 72, 11, INK, 'center');
      ctx.fillStyle = '#4a2a2a';
      rr(ctx, x + 132, y + 54, 112, 34, 6);
      ctx.fill();
      text(ctx, 'Sell ' + sellValue(tw) + '◆ [X]', x + 188, y + 72, 11, INK, 'center');
    }
  } else {
    text(ctx, 'Beacon lights 24 max.', x + 16, 590, 12, '#9aa3c0');
    text(ctx, 'Draw the road, then', x + 16, 610, 12, '#9aa3c0');
    text(ctx, 'plant lanterns by it.', x + 16, 632, 12, '#9aa3c0');
    text(ctx, 'A longer road helps.', x + 16, 652, 12, '#9aa3c0');
  }

  // start / speed buttons
  const by = 668;
  if (state.phase === 'draw') {
    ctx.fillStyle = '#7a5a1a';
    rr(ctx, x + 10, by, 238, 38, 6);
    ctx.fill();
    text(ctx, 'START NIGHT [Space]', x + 129, by + 19, 14, '#ffe9a8', 'center');
  } else if (state.phase === 'fight') {
    ctx.fillStyle = '#222a44';
    rr(ctx, x + 10, by, 238, 38, 6);
    ctx.fill();
    text(ctx, 'Night in progress', x + 129, by + 19, 15, '#9aa3c0', 'center');
  }
}

function drawBoons(ctx, view) {
  const { state } = view;
  ctx.fillStyle = 'rgba(10,13,26,0.72)';
  ctx.fillRect(0, 0, W, H);
  text(ctx, 'The night is held. Choose a boon.', W / 2, 150, 30, INK, 'center');
  text(ctx, 'Reroll once for 15 embers  [R]', W / 2, 186, 15, '#9aa3c0', 'center');
  const cw = 300;
  const gap = 24;
  const total = cw * 3 + gap * 2;
  const x0 = (W - total) / 2;
  for (let i = 0; i < state.boonChoices.length; i++) {
    const b = state.boonChoices[i];
    const x = x0 + i * (cw + gap);
    const y = 240;
    ctx.fillStyle = '#1d2444';
    rr(ctx, x, y, cw, 220, 10);
    ctx.fill();
    ctx.strokeStyle = AMBER;
    ctx.lineWidth = 2;
    rr(ctx, x, y, cw, 220, 10);
    ctx.stroke();
    text(ctx, b.title, x + cw / 2, y + 46, 20, AMBER, 'center');
    text(ctx, b.text, x + cw / 2, y + 90, 15, INK, 'center');
    text(ctx, '[' + (i + 1) + ']  choose', x + cw / 2, y + 180, 14, '#9aa3c0', 'center');
  }
}

function drawEnd(ctx, view, won) {
  const { state } = view;
  ctx.fillStyle = 'rgba(10,13,26,0.78)';
  ctx.fillRect(0, 0, W, H);
  text(ctx, won ? 'THE ROAD IS YOURS' : 'THE LIGHT HAS GONE OUT', W / 2, 200, 40, won ? AMBER : '#ff5d5d', 'center');
  const s = state.stats;
  const lines = [
    'Nights held: ' + s.nightsCleared,
    'Foes felled: ' + s.kills,
    'Embers earned: ' + s.earned,
    'Lanterns built: ' + s.towersBuilt,
    'Beacon light left: ' + Math.ceil(state.beaconHp) + ' / ' + state.beaconMax,
  ];
  lines.forEach((line, i) => text(ctx, line, W / 2, 270 + i * 30, 18, INK, 'center'));
  if (won) {
    text(ctx, '[E] keep walking — endless nights', W / 2, 470, 18, '#9aa3c0', 'center');
  }
  text(ctx, '[R] play again', W / 2, 506, 18, '#9aa3c0', 'center');
}

function drawTitle(ctx, view) {
  ctx.fillStyle = 'rgba(10,13,26,0.55)';
  ctx.fillRect(0, 0, W, H);
  text(ctx, 'ROADWARD', W / 2, 190, 72, AMBER, 'center');
  text(ctx, 'Draw the road the dark must walk.', W / 2, 250, 24, INK, 'center');
  text(ctx, 'A longer road keeps foes under your lanterns longer —', W / 2, 288, 17, '#c9cfdf', 'center');
  text(ctx, 'but every bend of it costs embers you could have spent on lanterns.', W / 2, 314, 17, '#c9cfdf', 'center');
  const bw = 220;
  const gap = 20;
  const x0 = (W - (bw * 3 + gap * 2)) / 2;
  view.difficulties.forEach((d, i) => {
    const x = x0 + i * (bw + gap);
    ctx.fillStyle = view.difficulty === d.key ? '#7a5a1a' : '#1d2444';
    rr(ctx, x, 380, bw, 96, 10);
    ctx.fill();
    if (view.difficulty === d.key) {
      ctx.strokeStyle = AMBER;
      ctx.lineWidth = 2;
      rr(ctx, x, 380, bw, 96, 10);
      ctx.stroke();
    }
    text(ctx, d.name, x + bw / 2, 412, 22, INK, 'center');
    text(ctx, d.blurb, x + bw / 2, 444, 13, '#c9cfdf', 'center');
  });
  text(ctx, 'Click a difficulty, then click anywhere to begin.', W / 2, 530, 17, '#9aa3c0', 'center');
  text(ctx, 'Drag gate to beacon to draw the road. 1-6 build. Space starts the night.', W / 2, 566, 15, '#6b7390', 'center');
  if (view.best > 0) {
    text(ctx, 'Best run: night ' + view.best, W / 2, 606, 15, AMBER, 'center');
  }
}
