// Render ROADWARD's screenshots in Node with the software canvas: the
// game's own draw code, the same deterministic scenes the browser's
// ?shot= mode builds, no browser installed. Run: node shots/render-shots.mjs

import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { drawGame, W, H } from '../game/render.mjs';
import { buildShotScene } from '../game/scenes.mjs';
import { gateRow, beaconRow } from '../game/levels.mjs';
import { makeRng } from '../game/rng.mjs';
import { SoftCanvas } from './canvas.mjs';
import { encodePNG } from './png.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const outDir = join(root, 'screenshots');
mkdirSync(outDir, { recursive: true });

const DIFF_LIST = [
  { key: 'ember', name: 'Ember', blurb: 'Gentle first road' },
  { key: 'blaze', name: 'Blaze', blurb: 'The road as meant' },
  { key: 'inferno', name: 'Inferno', blurb: 'Dark comes hungry' },
];

function stars() {
  const rng = makeRng(1234);
  const list = [];
  for (let i = 0; i < 90; i++) {
    list.push({
      x: rng.range(0, W),
      y: rng.range(0, H),
      tw: rng.range(0.5, 2),
      ph: rng.range(0, Math.PI * 2),
    });
  }
  return list;
}

const starField = stars();
const SEED = 7;
const SCENES = [
  ['1-play.png', 'play'],
  ['2-title.png', 'title'],
  ['3-boss.png', 'boss'],
  ['4-victory.png', 'victory'],
];

let ok = true;
for (const [file, sceneName] of SCENES) {
  const scene = buildShotScene(sceneName, SEED);
  const { state } = scene;
  const view = {
    state,
    selected: scene.selected || null,
    hover: null,
    mode: scene.mode,
    muted: true,
    speed: 1,
    paused: false,
    stars: starField,
    gateRow: gateRow(state.night),
    beaconRow: beaconRow(state.night),
    difficulties: DIFF_LIST,
    difficulty: scene.difficulty,
    best: scene.best,
  };
  const canvas = new SoftCanvas(W, H);
  drawGame(canvas, view);
  const png = encodePNG(W, H, canvas.buf);
  const path = join(outDir, file);
  writeFileSync(path, png);
  const kb = (png.length / 1024).toFixed(1);
  const within = png.length <= 262144;
  if (!within) ok = false;
  console.log(
    file.padEnd(14),
    sceneName.padEnd(8),
    'night ' + String(state.night).padStart(2),
    state.phase.padEnd(5),
    kb.padStart(7) + ' KiB',
    within ? 'OK' : 'OVER 256 KiB!',
  );
}
console.log(ok ? 'SHOTS PASS' : 'SHOTS FAIL');
process.exit(ok ? 0 : 1);
