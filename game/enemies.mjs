// Enemy kinds for ROADWARD. Speed is in cells per second; hp and reward
// scale with the night in levels.mjs. Armor shaves a flat amount off every
// hit (never below 1 damage).

export const ENEMY_TYPES = {
  shambler: {
    key: 'shambler',
    name: 'Shambler',
    hp: 30,
    speed: 0.9,
    reward: 4,
    leak: 1,
    armor: 0,
    color: '#8fae6b',
    dark: '#4a6b35',
    radius: 0.34,
  },
  skitter: {
    key: 'skitter',
    name: 'Skitter',
    hp: 12,
    speed: 2.0,
    reward: 3,
    leak: 1,
    armor: 0,
    color: '#e8d44d',
    dark: '#8a7a1a',
    radius: 0.24,
  },
  husk: {
    key: 'husk',
    name: 'Husk',
    hp: 95,
    speed: 0.6,
    reward: 7,
    leak: 1,
    armor: 2,
    color: '#9b8fa8',
    dark: '#5d5470',
    radius: 0.4,
  },
  wisp: {
    key: 'wisp',
    name: 'Murkwisp',
    hp: 20,
    speed: 1.6,
    reward: 5,
    leak: 1,
    armor: 0,
    slowImmune: true,
    color: '#b78cff',
    dark: '#6d4bb0',
    radius: 0.26,
  },
  spitter: {
    key: 'spitter',
    name: 'Spitter',
    hp: 42,
    speed: 0.8,
    reward: 8,
    leak: 1,
    armor: 0,
    shoots: true,
    shootRange: 3.0,
    shootRate: 0.7,
    shootDamage: 4,
    color: '#ff7a59',
    dark: '#a63d24',
    radius: 0.3,
  },
  brute: {
    key: 'brute',
    name: 'Brute',
    hp: 230,
    speed: 0.5,
    reward: 15,
    leak: 2,
    armor: 3,
    color: '#d1604d',
    dark: '#7d2f22',
    radius: 0.46,
  },
};

// Bosses. A boss walks the road like any enemy, but it has phases: crossing
// a health threshold changes it (faster, spawns adds) and the game announces it.
export const BOSSES = {
  herald: {
    key: 'herald',
    name: 'Murk Herald',
    hp: 1000,
    speed: 0.55,
    reward: 150,
    leak: 8,
    armor: 2,
    color: '#c96bff',
    dark: '#6d2a9e',
    radius: 0.62,
    phases: [
      { at: 0.5, speedMul: 1.35, spawn: 'skitter', spawnCount: 6, line: 'The Herald calls the skitters!' },
    ],
  },
  gloam: {
    key: 'gloam',
    name: 'The Gloam King',
    hp: 2800,
    speed: 0.45,
    reward: 450,
    leak: 20,
    armor: 4,
    color: '#ff4d6d',
    dark: '#8f1d33',
    radius: 0.72,
    phases: [
      { at: 0.66, speedMul: 1.3, spawn: 'wisp', spawnCount: 8, line: 'The King sheds his crown of wisps!' },
      { at: 0.33, speedMul: 1.5, spawn: 'brute', spawnCount: 2, line: 'The King rages. Brutes answer!' },
    ],
  },
};

export function enemyDef(kind) {
  return ENEMY_TYPES[kind] || null;
}

export function bossDef(kind) {
  return BOSSES[kind] || null;
}
