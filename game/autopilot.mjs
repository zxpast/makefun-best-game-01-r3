// Autopilot for ROADWARD. It plays through the same public functions a
// human uses (startDraft, extendDraft, confirmDraft, buildTower, startNight,
// chooseBoon), so a win it finds is a win a player could find. The Node
// self-test runs it across seeds and difficulties.

import {
  COLS, ROWS, CELL, newGame, startDraft, extendDraft, confirmDraft,
  cancelDraft, buildTower, upgradeTower, startNight, chooseBoon, step,
} from './sim.mjs';
import { DIFFICULTIES, gateRow, beaconRow, PAVE_COST, FREE_PAVE_CELLS } from './levels.mjs';
import { TOWER_TYPES } from './towers.mjs';

const DIRS = [[1, 0], [0, 1], [0, -1], [-1, 0]];

function key(c) {
  return c.x + ',' + c.y;
}

function inBounds(c) {
  return c.x >= 0 && c.x < COLS && c.y >= 0 && c.y < ROWS;
}

// Shortest distance from `from` to `goal` through cells not in `blocked`,
// ignoring visited cells. Infinity when unreachable.
function bfsDist(from, goal, blocked) {
  if (from.x === goal.x && from.y === goal.y) return 0;
  const seen = new Set([key(from)]);
  const queue = [{ c: from, d: 0 }];
  while (queue.length > 0) {
    const { c, d } = queue.shift();
    for (const [dx, dy] of DIRS) {
      const n = { x: c.x + dx, y: c.y + dy };
      if (!inBounds(n) || seen.has(key(n)) || blocked.has(key(n))) continue;
      if (n.x === goal.x && n.y === goal.y) return d + 1;
      seen.add(key(n));
      queue.push({ c: n, d: d + 1 });
    }
  }
  return Infinity;
}

// Plan a road from the gate to the beacon that stays under `maxLen` cells
// and prefers long, winding routes while the budget allows.
function planRoad(state, maxLen) {
  const start = { x: 0, y: gateRow(state.night) };
  const goal = { x: COLS - 1, y: beaconRow(state.night) };
  const blocked = new Set(state.towers.map((t) => t.cx + ',' + t.cy));
  const visited = new Set([key(start)]);
  const path = [start];
  let cur = start;
  while (!(cur.x === goal.x && cur.y === goal.y)) {
    const cands = [];
    for (const [dx, dy] of DIRS) {
      const n = { x: cur.x + dx, y: cur.y + dy };
      if (!inBounds(n) || visited.has(key(n)) || blocked.has(key(n))) continue;
      const d = bfsDist(n, goal, blocked);
      if (d === Infinity) continue;
      cands.push({ cell: n, dist: d });
    }
    if (cands.length === 0) return null;
    // While the road still has length to spare, wander; near the budget,
    // head for the beacon.
    const room = maxLen - path.length;
    cands.sort((a, b) => (room > 2 ? b.dist - a.dist : a.dist - b.dist));
    const pick = cands[0];
    if (path.length + pick.dist > maxLen) {
      // No room to wander: take the shortest way home.
      cands.sort((a, b) => a.dist - b.dist);
      const shortest = cands[0];
      if (path.length + shortest.dist > maxLen) return null;
      cur = shortest.cell;
    } else {
      cur = pick.cell;
    }
    visited.add(key(cur));
    path.push(cur);
  }
  return path;
}

function paveCost(cells) {
  return Math.max(0, cells - FREE_PAVE_CELLS) * PAVE_COST;
}

// How many road cells a tower on (cx, cy) can see.
function coverage(state, cx, cy, range) {
  let n = 0;
  for (const c of state.path) {
    const dx = c.x - cx;
    const dy = c.y - cy;
    if (Math.hypot(dx, dy) <= range + 0.5) n++;
  }
  return n;
}

function freePlots(state) {
  const onRoad = new Set(state.path.map((c) => key(c)));
  const taken = new Set(state.towers.map((t) => t.cx + ',' + t.cy));
  const plots = [];
  for (let x = 0; x < COLS; x++) {
    for (let y = 0; y < ROWS; y++) {
      if (onRoad.has(x + ',' + y) || taken.has(x + ',' + y)) continue;
      // Only plots touching the road are worth a lantern.
      let near = false;
      for (const c of state.path) {
        if (Math.abs(c.x - x) + Math.abs(c.y - y) === 1) {
          near = true;
          break;
        }
      }
      if (near) plots.push({ x, y });
    }
  }
  return plots;
}

// Desired mix, as shares of the towers on the field.
const MIX = [
  ['ember', 0.38],
  ['sniper', 0.2],
  ['frost', 0.14],
  ['brazier', 0.14],
  ['bell', 0.05],
  ['cannon', 0.09],
];

function nextType(state) {
  const counts = {};
  for (const t of state.towers) counts[t.def.key] = (counts[t.def.key] || 0) + 1;
  const total = Math.max(1, state.towers.length);
  let best = null;
  let bestGap = -Infinity;
  for (const [type, share] of MIX) {
    const def = TOWER_TYPES.find((d) => d.key === type);
    if (!def || state.embers < def.cost) continue;
    const gap = share - (counts[type] || 0) / total;
    if (gap > bestGap) {
      bestGap = gap;
      best = type;
    }
  }
  return best;
}

function spendEmbers(state) {
  // Build until the purse is light, then upgrade what stands.
  let guard = 0;
  while (guard++ < 40) {
    const type = nextType(state);
    if (!type) break;
    const def = TOWER_TYPES.find((d) => d.key === type);
    const plots = freePlots(state);
    if (plots.length === 0) break;
    let bestPlot = null;
    let bestCov = -1;
    for (const p of plots) {
      const cov = coverage(state, p.x, p.y, def.range);
      if (cov > bestCov) {
        bestCov = cov;
        bestPlot = p;
      }
    }
    if (!bestPlot || bestCov === 0) break;
    buildTower(state, type, bestPlot.x, bestPlot.y);
  }
  // Upgrades with whatever is left.
  for (let round = 0; round < 3; round++) {
    let upgraded = false;
    const sorted = state.towers.slice().sort((a, b) => b.def.cost - a.def.cost);
    for (const t of sorted) {
      if (t.level < 3 && upgradeTower(state, t.id)) upgraded = true;
    }
    if (!upgraded) break;
  }
}

function drawRoad(state) {
  for (const maxLen of [34, 30, 26, 22, 18]) {
    const plan = planRoad(state, maxLen);
    if (!plan) continue;
    if (paveCost(plan.length) > state.embers + 20) continue;
    if (!startDraft(state, plan[0].x, plan[0].y)) continue;
    let ok = true;
    for (let i = 1; i < plan.length; i++) {
      if (!extendDraft(state, plan[i].x, plan[i].y)) {
        ok = false;
        break;
      }
    }
    if (!ok) {
      cancelDraft(state);
      continue;
    }
    if (confirmDraft(state)) return true;
    cancelDraft(state);
  }
  return false;
}

function chooseBestBoon(state) {
  const byId = Object.fromEntries(state.boonChoices.map((b) => [b.id, b]));
  const pick = ['sharpen', 'far', 'quick', 'mend', 'purse', 'chill', 'stone', 'free-road']
    .map((id) => byId[id])
    .find(Boolean);
  if (!pick) return false;
  // Mend only matters when the beacon is hurt.
  if (pick.id === 'mend' && state.beaconHp > state.beaconMax - 8) {
    const alt = byId.purse || byId.sharpen || byId.far || byId.quick;
    if (alt) return chooseBoon(state, alt.id);
  }
  return chooseBoon(state, pick.id);
}

export function createBot(state) {
  let acted = false;
  return {
    update() {
      if (state.phase === 'draw' && !acted) {
        acted = true;
        drawRoad(state);
        spendEmbers(state);
        startNight(state);
      } else if (state.phase === 'fight') {
        // Reinforce mid-fight when the purse allows.
        if (state.embers >= 60) spendEmbers(state);
      } else if (state.phase === 'boon') {
        chooseBestBoon(state);
        acted = false;
      }
    },
  };
}

// Play a whole game headlessly. Returns a summary for the self-test.
export function playGame(seed, difficultyKey, maxSteps = 60 * 60 * 30) {
  const difficulty = DIFFICULTIES[difficultyKey];
  const state = newGame(seed, difficulty);
  const bot = createBot(state);
  let steps = 0;
  while (state.phase !== 'won' && state.phase !== 'lost' && steps < maxSteps) {
    bot.update();
    step(state, 1 / 60);
    steps++;
  }
  return {
    seed,
    difficulty: difficultyKey,
    result: state.phase,
    night: state.night,
    nightsCleared: state.stats.nightsCleared,
    kills: state.stats.kills,
    earned: state.stats.earned,
    leaked: state.stats.leaked,
    towersBuilt: state.stats.towersBuilt,
    beaconHp: Math.ceil(state.beaconHp),
    embers: Math.floor(state.embers),
    steps,
    minutes: (steps / 60 / 60).toFixed(1),
  };
}
