// Node self-test for ROADWARD. Plays full games with the autopilot across
// seeds and difficulties, checks the same seed always plays the same game,
// and prints the results. Run: node test/sim-test.mjs

import { playGame } from '../game/autopilot.mjs';
import { newGame, step } from '../game/sim.mjs';
import { DIFFICULTIES } from '../game/levels.mjs';

function determinismCheck() {
  const a = playGame(7, 'ember');
  const b = playGame(7, 'ember');
  const same = JSON.stringify(a) === JSON.stringify(b);
  console.log('determinism seed 7 ember:', same ? 'PASS (identical)' : 'FAIL');
  if (!same) {
    console.log('  run A:', JSON.stringify(a));
    console.log('  run B:', JSON.stringify(b));
  }
  return same;
}

function smokeStep() {
  // A fresh game steps without throwing, even before any road is drawn.
  const s = newGame(1, DIFFICULTIES.blaze);
  for (let i = 0; i < 600; i++) step(s, 1 / 60);
  console.log('smoke 10s draw-phase step: PASS (phase ' + s.phase + ')');
  return true;
}

const okDet = determinismCheck();
const okSmoke = smokeStep();

console.log('');
console.log('seed  diff     result  night  kills  earned  leaked  towers  beacon  mins');
let wins = { ember: 0, blaze: 0, inferno: 0 };
let total = { ember: 0, blaze: 0, inferno: 0 };
for (const diff of ['ember', 'blaze', 'inferno']) {
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]) {
    const r = playGame(seed, diff);
    total[diff]++;
    if (r.result === 'won') wins[diff]++;
    console.log(
      String(seed).padStart(4),
      diff.padEnd(8),
      r.result.padEnd(6),
      String(r.night).padStart(5),
      String(r.kills).padStart(6),
      String(r.earned).padStart(7),
      String(r.leaked).padStart(7),
      String(r.towersBuilt).padStart(7),
      String(r.beaconHp).padStart(6),
      String(r.minutes).padStart(5),
    );
  }
}

console.log('');
for (const diff of ['ember', 'blaze', 'inferno']) {
  console.log('autopilot wins on ' + diff + ': ' + wins[diff] + '/' + total[diff]);
}
const ok = okDet && okSmoke && wins.ember >= 10;
console.log(ok ? 'SELF-TEST PASS' : 'SELF-TEST FAIL (ember wins < 10/12 or a check failed)');
process.exit(ok ? 0 : 1);
