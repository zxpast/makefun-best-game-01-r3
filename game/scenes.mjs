// Deterministic screenshot scenes for ROADWARD. Each scene plays the real
// game (sim + autopilot) to the requested moment, so the screenshots show
// the game itself, not a mock-up. Used by main.mjs (?shot=) in the browser
// and by shots/render-shots.mjs in Node.

import { newGame, step } from './sim.mjs';
import { DIFFICULTIES } from './levels.mjs';
import { createBot } from './autopilot.mjs';

function runUntil(state, bot, pred, maxSteps) {
  let steps = 0;
  while (!pred(state) && steps < maxSteps) {
    bot.update();
    step(state, 1 / 60);
    steps++;
  }
  return steps;
}

export function buildShotScene(name, seed) {
  const difficulty = 'blaze';
  const state = newGame(seed, DIFFICULTIES[difficulty]);
  const bot = createBot(state);

  if (name === 'title') {
    // A quiet draw-phase board with a few lanterns already standing.
    runUntil(state, bot, (s) => s.phase === 'fight', 60 * 5);
    state.banner = '';
    state.bannerTimer = 0;
    return { state, mode: 'title', difficulty, best: 4, selected: null };
  }

  if (name === 'play') {
    // Mid-fight on night 4, road busy, lanterns firing.
    runUntil(
      state,
      bot,
      (s) => s.night === 4 && s.phase === 'fight' && s.enemies.length >= 5,
      60 * 60 * 6,
    );
    return { state, mode: 'game', difficulty, best: 4, selected: { kind: 'build', type: 'sniper' } };
  }

  if (name === 'boss') {
    // Night 10, the Gloam King on the road.
    runUntil(
      state,
      bot,
      (s) => s.night === 10 && s.phase === 'fight' && s.enemies.some((e) => e.isBoss),
      60 * 60 * 12,
    );
    return { state, mode: 'game', difficulty, best: 9, selected: null };
  }

  if (name === 'victory') {
    runUntil(state, bot, (s) => s.phase === 'won', 60 * 60 * 15);
    state.banner = '';
    state.bannerTimer = 0;
    return { state, mode: 'game', difficulty, best: 10, selected: null };
  }

  // Fallback: the draw phase of night 1.
  return { state, mode: 'game', difficulty, best: 0, selected: null };
}
