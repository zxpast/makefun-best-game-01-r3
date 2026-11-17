// Pure simulation for ROADWARD. No DOM, no audio, no wall clock: the same
// seed and the same inputs always play the same game, so the autopilot can
// prove a win in plain Node and the browser only renders what this file
// decides. The loop calls step(1/60) at a fixed rate.

import { makeRng } from './rng.mjs';
import { TOWER_BY_KEY, towerStats, upgradeCost, sellValue, bellBuff } from './towers.mjs';
import { enemyDef, bossDef } from './enemies.mjs';
import {
  nightComposition, nightHpMul, spawnInterval, gateRow, beaconRow,
  NIGHTS_TO_WIN, PAVE_COST, FREE_PAVE_CELLS, NIGHT_STIPEND, rollBoons,
} from './levels.mjs';

export const COLS = 16;
export const ROWS = 10;
export const CELL = 60;
export const FIELD_X = 40;
export const FIELD_Y = 60;
export const MAX_PATH_LEN = 34;
export const MAX_TOWERS = 24; // the beacon can light at most this many lanterns

let nextId = 1;

export function cellCenter(cx, cy) {
  return { x: FIELD_X + cx * CELL + CELL / 2, y: FIELD_Y + cy * CELL + CELL / 2 };
}

export function newGame(seed, difficulty) {
  const rng = makeRng(seed);
  const state = {
    seed,
    difficulty,
    rng,
    night: 1,
    endless: false,
    phase: 'draw', // draw | fight | boon | won | lost
    embers: difficulty.startEmbers,
    beaconHp: difficulty.beaconMax,
    beaconMax: difficulty.beaconMax,
    path: [],
    pavePaid: 0,
    draft: [],
    towers: [],
    enemies: [],
    projectiles: [],
    particles: [],
    floaters: [],
    spawnQueue: [],
    spawnTimer: 0,
    spawnTotal: 0,
    spawnLeft: 0,
    boonChoices: [],
    mods: { damage: 0, range: 0, rate: 0, slow: 0, towerArmor: 0, freePaveNext: false },
    stats: { kills: 0, earned: 0, leaked: 0, towersBuilt: 0, damageDealt: 0, nightsCleared: 0 },
    time: 0,
    hitStop: 0,
    shake: 0,
    banner: '',
    bannerTimer: 0,
    events: [],
    rerolled: false,
    selected: null,
  };
  // A straight starter road so the first night can begin at once.
  const gr = gateRow(1);
  const br = beaconRow(1);
  const straight = [];
  for (let x = 0; x < COLS; x++) {
    const y = Math.round(gr + ((br - gr) * x) / (COLS - 1));
    straight.push({ x, y });
  }
  state.path = straight;
  state.pavePaid = 0;
  state.banner = 'Night 1 — draw a road, then hold it';
  state.bannerTimer = 3;
  return state;
}

function cellKey(c) {
  return c.x + ',' + c.y;
}

function onPath(state, cx, cy) {
  return state.path.some((c) => c.x === cx && c.y === cy);
}

function towerAt(state, cx, cy) {
  return state.towers.find((t) => t.cx === cx && t.cy === cy) || null;
}

function paveCostFor(state, cells) {
  if (state.mods.freePaveNext) return 0;
  return Math.max(0, cells - FREE_PAVE_CELLS) * PAVE_COST;
}

// ---- road drawing -------------------------------------------------------

export function startDraft(state, cx, cy) {
  if (state.phase !== 'draw') return false;
  if (cx !== 0 || cy !== gateRow(state.night)) return false;
  state.draft = [{ x: 0, y: cy }];
  return true;
}

export function extendDraft(state, cx, cy) {
  if (state.phase !== 'draw' || state.draft.length === 0) return false;
  if (cx < 0 || cx >= COLS || cy < 0 || cy >= ROWS) return false;
  const last = state.draft[state.draft.length - 1];
  const dx = Math.abs(cx - last.x);
  const dy = Math.abs(cy - last.y);
  if (dx + dy !== 1) return false;
  if (state.draft.some((c) => c.x === cx && c.y === cy)) return false;
  if (towerAt(state, cx, cy)) return false;
  if (state.draft.length >= MAX_PATH_LEN) return false;
  state.draft.push({ x: cx, y: cy });
  return true;
}

export function confirmDraft(state) {
  if (state.phase !== 'draw' || state.draft.length < 2) return false;
  const last = state.draft[state.draft.length - 1];
  if (last.x !== COLS - 1 || last.y !== beaconRow(state.night)) return false;
  const cost = paveCostFor(state, state.draft.length);
  if (cost > state.embers) return false;
  state.embers += state.pavePaid; // refund the old road
  state.embers -= cost;
  state.pavePaid = cost;
  state.path = state.draft.slice();
  state.draft = [];
  state.mods.freePaveNext = false;
  return true;
}

export function cancelDraft(state) {
  state.draft = [];
}

// ---- towers -------------------------------------------------------------

export function canBuild(state, key, cx, cy) {
  if (state.phase !== 'draw' && state.phase !== 'fight') return false;
  if (state.towers.length >= MAX_TOWERS) return false;
  if (cx < 0 || cx >= COLS || cy < 0 || cy >= ROWS) return false;
  if (onPath(state, cx, cy)) return false;
  if (towerAt(state, cx, cy)) return false;
  const def = TOWER_BY_KEY[key];
  if (!def) return false;
  return state.embers >= def.cost;
}

export function buildTower(state, key, cx, cy) {
  if (!canBuild(state, key, cx, cy)) return null;
  const def = TOWER_BY_KEY[key];
  state.embers -= def.cost;
  const tower = {
    id: nextId++,
    def,
    cx,
    cy,
    level: 1,
    hp: 50,
    maxHp: 50,
    kills: 0,
    cooldown: 0,
    shootCooldown: 0,
    flash: 0,
  };
  state.towers.push(tower);
  state.stats.towersBuilt++;
  state.events.push('build');
  burst(state, cellCenter(cx, cy).x, cellCenter(cx, cy).y, def.color, 10, 2.2);
  return tower;
}

export function upgradeTower(state, id) {
  const t = state.towers.find((x) => x.id === id);
  if (!t || t.level >= 3) return false;
  const cost = upgradeCost(t.def, t.level);
  if (state.embers < cost) return false;
  state.embers -= cost;
  t.level++;
  t.maxHp += 25;
  t.hp = t.maxHp;
  state.events.push('build');
  const p = cellCenter(t.cx, t.cy);
  burst(state, p.x, p.y, '#ffe9a8', 14, 2.6);
  return true;
}

export function sellTower(state, id) {
  const i = state.towers.findIndex((x) => x.id === id);
  if (i < 0) return false;
  state.embers += sellValue(state.towers[i]);
  state.towers.splice(i, 1);
  state.events.push('coin');
  return true;
}

// ---- nights -------------------------------------------------------------

export function startNight(state) {
  if (state.phase !== 'draw') return false;
  if (state.path.length < 2) return false;
  state.spawnQueue = nightComposition(state.night, state.rng);
  state.spawnTotal = state.spawnQueue.length;
  state.spawnLeft = state.spawnTotal;
  state.spawnTimer = 0.8;
  state.embers += NIGHT_STIPEND;
  state.phase = 'fight';
  state.banner = 'Night ' + state.night + ' — ' + state.spawnTotal + ' march on the road';
  state.bannerTimer = 2.5;
  state.events.push('horn');
  return true;
}

export function chooseBoon(state, boonId) {
  if (state.phase !== 'boon') return false;
  const boon = state.boonChoices.find((b) => b.id === boonId);
  if (!boon) return false;
  boon.apply(state);
  state.boonChoices = [];
  state.rerolled = false;
  state.night++;
  state.phase = 'draw';
  state.banner = 'Night ' + state.night + ' — draw the road';
  state.bannerTimer = 2.5;
  state.events.push('coin');
  return true;
}

export function rerollBoons(state) {
  if (state.phase !== 'boon' || state.rerolled) return false;
  if (state.embers < 15) return false;
  state.embers -= 15;
  state.rerolled = true;
  state.boonChoices = rollBoons(state.rng, 3);
  return true;
}

export function continueEndless(state) {
  if (state.phase !== 'won') return false;
  state.endless = true;
  state.night = NIGHTS_TO_WIN + 1;
  state.phase = 'draw';
  state.banner = 'Endless — the road goes on';
  state.bannerTimer = 2.5;
  return true;
}

// ---- combat -------------------------------------------------------------

function spawnEnemy(state, kind) {
  const isBoss = kind.startsWith('boss:');
  const def = isBoss ? bossDef(kind.slice(5)) : enemyDef(kind);
  if (!def) return;
  const hpMul = nightHpMul(state.night, state.difficulty);
  const start = cellCenter(state.path[0].x, state.path[0].y);
  const enemy = {
    id: nextId++,
    kind: isBoss ? 'boss:' + kind.slice(5) : kind,
    name: def.name,
    isBoss,
    hp: def.hp * hpMul,
    maxHp: def.hp * hpMul,
    speed: def.speed,
    baseSpeed: def.speed,
    reward: Math.round(def.reward * state.difficulty.rewardMul),
    leak: def.leak,
    armor: def.armor,
    color: def.color,
    dark: def.dark,
    radius: def.radius,
    slowImmune: !!def.slowImmune,
    shoots: !!def.shoots,
    shootRange: def.shootRange || 0,
    shootRate: def.shootRate || 0,
    shootDamage: def.shootDamage || 0,
    shootCooldown: 0,
    slowUntil: 0,
    slowFactor: 1,
    dist: 0,
    x: start.x,
    y: start.y,
    phaseIndex: 0,
    phases: def.phases || null,
    flash: 0,
  };
  state.enemies.push(enemy);
}

function enemyPos(state, enemy) {
  const path = state.path;
  const idx = Math.min(Math.floor(enemy.dist), path.length - 2);
  const frac = Math.min(enemy.dist - idx, 1);
  const a = cellCenter(path[idx].x, path[idx].y);
  const b = cellCenter(path[idx + 1].x, path[idx + 1].y);
  enemy.x = a.x + (b.x - a.x) * frac;
  enemy.y = a.y + (b.y - a.y) * frac;
}

function damageEnemy(state, enemy, amount, source) {
  const dealt = Math.max(1, Math.round(amount - enemy.armor));
  enemy.hp -= dealt;
  enemy.flash = 0.08;
  state.stats.damageDealt += dealt;
  if (source && source.slow && !enemy.slowImmune) {
    enemy.slowUntil = state.time + source.slowSecs;
    enemy.slowFactor = 1 - source.slow * (1 + state.mods.slow);
  }
  if (enemy.hp <= 0) killEnemy(state, enemy);
}

function killEnemy(state, enemy) {
  const i = state.enemies.indexOf(enemy);
  if (i < 0) return;
  state.enemies.splice(i, 1);
  state.embers += enemy.reward;
  state.stats.earned += enemy.reward;
  state.stats.kills++;
  state.events.push('kill');
  addFloater(state, enemy.x, enemy.y - 14, '+' + enemy.reward, '#ffd166');
  burst(state, enemy.x, enemy.y, enemy.color, enemy.isBoss ? 40 : 12, enemy.isBoss ? 4 : 2.4);
  if (enemy.isBoss) {
    state.hitStop = 0.25;
    state.shake = 14;
    state.banner = enemy.name + ' has fallen!';
    state.bannerTimer = 2;
    state.events.push('boss-down');
  }
}

function burst(state, x, y, color, n, speed) {
  for (let i = 0; i < n; i++) {
    const a = state.rng.range(0, Math.PI * 2);
    const v = state.rng.range(0.3, 1) * speed * CELL;
    state.particles.push({
      x, y,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v - 20,
      life: state.rng.range(0.3, 0.7),
      maxLife: 0.7,
      color,
      size: state.rng.range(2, 5),
    });
  }
  if (state.particles.length > 400) state.particles.splice(0, state.particles.length - 400);
}

function addFloater(state, x, y, text, color) {
  state.floaters.push({ x, y, text, color, life: 1.1, maxLife: 1.1 });
  if (state.floaters.length > 40) state.floaters.shift();
}

function towerTarget(state, tower) {
  const stats = towerStats(tower.def, tower.level);
  const rangePx = stats.range * (1 + state.mods.range) * CELL;
  const tp = cellCenter(tower.cx, tower.cy);
  let best = null;
  let bestScore = -Infinity;
  for (const e of state.enemies) {
    const d = Math.hypot(e.x - tp.x, e.y - tp.y);
    if (d > rangePx + e.radius * CELL) continue;
    let score;
    if (tower.def.key === 'sniper') score = e.maxHp;
    else score = e.dist;
    if (score > bestScore) {
      bestScore = score;
      best = e;
    }
  }
  return best;
}

function fireTower(state, tower, target) {
  const stats = towerStats(tower.def, tower.level);
  const buff = bellBuff(state.towers, tower.cx, tower.cy);
  const tp = cellCenter(tower.cx, tower.cy);
  tower.cooldown = 1 / (stats.rate * (1 + state.mods.rate));
  tower.flash = 0.1;
  state.projectiles.push({
    x: tp.x,
    y: tp.y,
    towerId: tower.id,
    targetId: target.id,
    tx: target.x,
    ty: target.y,
    speed: 15 * CELL,
    damage: stats.damage * (1 + state.mods.damage) * (1 + buff),
    splash: stats.splash,
    slow: stats.slow,
    slowSecs: stats.slowSecs,
    color: tower.def.color,
    kind: tower.def.key,
  });
  state.events.push('shoot');
}

// ---- step ---------------------------------------------------------------

export function step(state, dt) {
  state.time += dt;
  if (state.bannerTimer > 0) state.bannerTimer -= dt;
  if (state.hitStop > 0) {
    state.hitStop -= dt;
    updateFx(state, dt);
    return;
  }
  if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 30);

  if (state.phase === 'fight') {
    // spawning
    if (state.spawnQueue.length > 0) {
      state.spawnTimer -= dt;
      if (state.spawnTimer <= 0) {
        state.spawnTimer = spawnInterval(state.night);
        spawnEnemy(state, state.spawnQueue.shift());
        state.spawnLeft = state.spawnQueue.length + state.enemies.length;
      }
    }

    // enemies move, spitters shoot, bosses phase
    for (const e of state.enemies.slice()) {
      if (e.flash > 0) e.flash -= dt;
      // boss phases
      if (e.phases && e.phaseIndex < e.phases.length) {
        const ph = e.phases[e.phaseIndex];
        if (e.hp <= e.maxHp * ph.at) {
          e.phaseIndex++;
          e.baseSpeed *= ph.speedMul;
          e.speed = e.baseSpeed;
          for (let i = 0; i < ph.spawnCount; i++) {
            const add = enemyDef(ph.spawn);
            const start = cellCenter(state.path[0].x, state.path[0].y);
            state.enemies.push({
              id: nextId++, kind: ph.spawn, name: add.name, isBoss: false,
              hp: add.hp * nightHpMul(state.night, state.difficulty),
              maxHp: add.hp * nightHpMul(state.night, state.difficulty),
              speed: add.speed, baseSpeed: add.speed,
              reward: Math.round(add.reward * state.difficulty.rewardMul),
              leak: add.leak, armor: add.armor, color: add.color, dark: add.dark,
              radius: add.radius, slowImmune: !!add.slowImmune, shoots: false,
              slowUntil: 0, slowFactor: 1, dist: 0, x: start.x, y: start.y,
              phaseIndex: 0, phases: null, flash: 0, shootCooldown: 0,
            });
          }
          state.banner = ph.line;
          state.bannerTimer = 2;
          state.hitStop = 0.12;
          state.events.push('boss-phase');
        }
      }
      // spitter stops to shoot towers
      let stopped = false;
      if (e.shoots) {
        let prey = null;
        let preyD = Infinity;
        for (const t of state.towers) {
          const tp = cellCenter(t.cx, t.cy);
          const d = Math.hypot(tp.x - e.x, tp.y - e.y) / CELL;
          if (d <= e.shootRange && d < preyD) {
            preyD = d;
            prey = t;
          }
        }
        if (prey) {
          stopped = true;
          e.shootCooldown -= dt;
          if (e.shootCooldown <= 0) {
            e.shootCooldown = 1 / e.shootRate;
            const dmg = e.shootDamage * (1 - state.mods.towerArmor * 0.5);
            prey.hp -= dmg;
            prey.flash = 0.15;
            burst(state, cellCenter(prey.cx, prey.cy).x, cellCenter(prey.cx, prey.cy).y, '#ff7a59', 4, 1.6);
            state.events.push('tower-hit');
            if (prey.hp <= 0) {
              const p = cellCenter(prey.cx, prey.cy);
              burst(state, p.x, p.y, '#8a7a6a', 22, 3);
              state.towers.splice(state.towers.indexOf(prey), 1);
              state.events.push('tower-down');
              addFloater(state, p.x, p.y - 10, 'Lantern lost!', '#ff7a59');
            }
          }
        }
      }
      if (!stopped) {
        const slowed = !e.slowImmune && state.time < e.slowUntil;
        const sp = e.baseSpeed * (slowed ? e.slowFactor : 1);
        e.dist += sp * dt;
        enemyPos(state, e);
        if (e.dist >= state.path.length - 1) {
          state.enemies.splice(state.enemies.indexOf(e), 1);
          state.beaconHp -= e.leak;
          state.stats.leaked++;
          state.shake = Math.max(state.shake, 8);
          state.events.push('leak');
          addFloater(state, cellCenter(state.path[state.path.length - 1].x, state.path[state.path.length - 1].y).x, FIELD_Y + 20, '-' + e.leak + ' light', '#ff5d5d');
          if (state.beaconHp <= 0) {
            state.beaconHp = 0;
            state.phase = 'lost';
            state.banner = 'The light has gone out.';
            state.bannerTimer = 99;
            state.events.push('lose');
          }
        }
      }
    }

    // towers fire
    for (const t of state.towers) {
      if (t.flash > 0) t.flash -= dt;
      if (t.def.key === 'bell') continue;
      t.cooldown -= dt;
      if (t.cooldown <= 0) {
        const target = towerTarget(state, t);
        if (target) fireTower(state, t, target);
      }
    }

    // projectiles fly and land
    for (const p of state.projectiles.slice()) {
      const target = state.enemies.find((e) => e.id === p.targetId);
      const tx = target ? target.x : p.tx;
      const ty = target ? target.y : p.ty;
      const dx = tx - p.x;
      const dy = ty - p.y;
      const d = Math.hypot(dx, dy);
      const stepLen = p.speed * dt;
      if (d <= stepLen + 6) {
        state.projectiles.splice(state.projectiles.indexOf(p), 1);
        if (target) {
          const shooter = state.towers.find((t) => t.id === p.towerId);
          const before = state.enemies.length;
          if (p.splash > 0) {
            for (const e of state.enemies.slice()) {
              if (Math.hypot(e.x - tx, e.y - ty) <= p.splash * CELL) {
                damageEnemy(state, e, p.damage, p);
              }
            }
            burst(state, tx, ty, p.color, 8, 2);
          } else {
            damageEnemy(state, target, p.damage, p);
            burst(state, tx, ty, p.color, 4, 1.4);
          }
          if (shooter) shooter.kills += before - state.enemies.length;
        }
      } else {
        p.x += (dx / d) * stepLen;
        p.y += (dy / d) * stepLen;
      }
    }

    // night cleared?
    if (state.spawnQueue.length === 0 && state.enemies.length === 0 && state.phase === 'fight') {
      state.stats.nightsCleared++;
      if (state.night >= NIGHTS_TO_WIN && !state.endless) {
        state.phase = 'won';
        state.banner = 'Ten nights held. The road is yours.';
        state.bannerTimer = 99;
        state.events.push('win');
      } else {
        state.phase = 'boon';
        state.boonChoices = rollBoons(state.rng, 3);
        state.banner = 'Night ' + state.night + ' held — choose a boon';
        state.bannerTimer = 99;
        state.events.push('night-clear');
      }
    }
  }

  updateFx(state, dt);
}

function updateFx(state, dt) {
  for (const p of state.particles.slice()) {
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 60 * dt;
    if (p.life <= 0) state.particles.splice(state.particles.indexOf(p), 1);
  }
  for (const f of state.floaters.slice()) {
    f.life -= dt;
    f.y -= 28 * dt;
    if (f.life <= 0) state.floaters.splice(state.floaters.indexOf(f), 1);
  }
  for (const t of state.towers) {
    if (t.flash > 0) t.flash -= dt;
  }
}
