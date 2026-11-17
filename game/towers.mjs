// Tower (lantern) definitions for ROADWARD. A tower is a lantern planted on
// a free plot beside the road. Stats are per level; upgrading multiplies
// damage and range and, for the Frost Wisp, the slow.

export const TOWER_TYPES = [
  {
    key: 'ember',
    name: 'Ember Spitter',
    short: 'Ember',
    cost: 18,
    range: 2.2,
    rate: 2.2,
    damage: 7,
    color: '#ff9a3c',
    dark: '#b35c12',
    desc: 'Cheap and fast.',
    hotkey: '1',
  },
  {
    key: 'sniper',
    name: 'Cinder Sniper',
    short: 'Sniper',
    cost: 40,
    range: 4.6,
    rate: 0.7,
    damage: 30,
    color: '#ffd166',
    dark: '#a67c1a',
    desc: 'Long reach.',
    hotkey: '2',
  },
  {
    key: 'frost',
    name: 'Frost Wisp',
    short: 'Frost',
    cost: 30,
    range: 2.5,
    rate: 1.2,
    damage: 2,
    slow: 0.45,
    slowSecs: 1.6,
    color: '#7fe7ff',
    dark: '#2a7ea6',
    desc: 'Chills foes.',
    hotkey: '3',
  },
  {
    key: 'brazier',
    name: 'Splash Brazier',
    short: 'Brazier',
    cost: 50,
    range: 2.8,
    rate: 0.8,
    damage: 10,
    splash: 1.2,
    color: '#ff5d5d',
    dark: '#a62a2a',
    desc: 'Fire spills.',
    hotkey: '4',
  },
  {
    key: 'bell',
    name: 'Dawn Bell',
    short: 'Bell',
    cost: 45,
    range: 2.5,
    rate: 0,
    damage: 0,
    buff: 0.3,
    color: '#ffe9a8',
    dark: '#a68f3a',
    desc: 'Buffs others.',
    hotkey: '5',
  },
  {
    key: 'cannon',
    name: 'Moonpetal Cannon',
    short: 'Cannon',
    cost: 80,
    range: 3.2,
    rate: 0.35,
    damage: 70,
    splash: 1.6,
    color: '#c9a7ff',
    dark: '#6d4bb0',
    desc: 'Slow and huge.',
    hotkey: '6',
  },
];

export const TOWER_BY_KEY = Object.fromEntries(TOWER_TYPES.map((t) => [t.key, t]));

// Upgrade multipliers per level (level 1 is the base above).
export function towerStats(def, level) {
  const dmgMul = 1 + 0.45 * (level - 1);
  const rangeMul = 1 + 0.15 * (level - 1);
  return {
    damage: def.damage * dmgMul,
    range: def.range * rangeMul,
    rate: def.rate,
    splash: def.splash ? def.splash * (1 + 0.1 * (level - 1)) : 0,
    slow: def.slow || 0,
    slowSecs: def.slowSecs || 0,
    buff: def.buff ? def.buff * (1 + 0.25 * (level - 1)) : 0,
  };
}

export function upgradeCost(def, level) {
  // cost to go from `level` to `level + 1`
  return Math.round(def.cost * (level === 1 ? 0.6 : 1.0));
}

export function sellValue(tower) {
  let invested = tower.def.cost;
  for (let l = 1; l < tower.level; l++) invested += upgradeCost(tower.def, l);
  return Math.floor(invested * 0.6);
}

// A tower's damage buff from neighbouring Dawn Bells (level 1+).
export function bellBuff(towers, cx, cy) {
  let buff = 0;
  for (const other of towers) {
    if (other.def.key !== 'bell') continue;
    const d = Math.hypot(other.cx - cx, other.cy - cy);
    if (d <= towerStats(other.def, other.level).range) {
      buff += towerStats(other.def, other.level).buff;
    }
  }
  return buff;
}
