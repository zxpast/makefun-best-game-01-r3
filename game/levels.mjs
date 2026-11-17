// Nights, difficulties and boons for ROADWARD.

export const DIFFICULTIES = {
  ember: {
    key: 'ember',
    name: 'Ember',
    label: 'Ember — a gentle first road',
    hpMul: 0.85,
    beaconMax: 24,
    startEmbers: 80,
    rewardMul: 1.0,
  },
  blaze: {
    key: 'blaze',
    name: 'Blaze',
    label: 'Blaze — the road as it is meant to be',
    hpMul: 1.0,
    beaconMax: 20,
    startEmbers: 70,
    rewardMul: 1.0,
  },
  inferno: {
    key: 'inferno',
    name: 'Inferno',
    label: 'Inferno — the dark comes hungry',
    hpMul: 1.2,
    beaconMax: 16,
    startEmbers: 60,
    rewardMul: 1.15,
  },
};

export const NIGHTS_TO_WIN = 10;
export const PAVE_COST = 1; // embers per road cell
export const FREE_PAVE_CELLS = 16; // the straight road costs nothing
export const NIGHT_STIPEND = 15; // embers granted at the start of each night

// How many of each kind march on a given night (1-based). Boss nights add
// the boss at the end of the queue. Endless nights (11+) keep scaling.
export function nightComposition(night, rng) {
  const list = [];
  const add = (kind, n) => {
    for (let i = 0; i < n; i++) list.push(kind);
  };
  add('shambler', 5 + night * 2);
  add('skitter', Math.max(0, (night - 1) * 2));
  if (night >= 2) add('husk', 1 + Math.floor(night / 2));
  if (night >= 3) add('wisp', 1 + Math.floor(night / 2));
  if (night >= 4) add('spitter', Math.floor(night / 2));
  if (night >= 3 && night % 3 === 0) add('brute', 1 + Math.floor(night / 5));
  if (night === 5) list.push('boss:herald');
  if (night === 10) list.push('boss:gloam');
  if (night > 10) {
    add('brute', Math.floor((night - 10) / 2) + 1);
    if (night % 5 === 0) list.push('boss:herald');
  }
  // Shuffle, but keep the boss (if any) last.
  const bosses = list.filter((k) => k.startsWith('boss:'));
  const rest = rng.shuffle(list.filter((k) => !k.startsWith('boss:')));
  return rest.concat(bosses);
}

export function nightHpMul(night, difficulty) {
  return (1 + 0.38 * (night - 1)) * difficulty.hpMul;
}

export function spawnInterval(night) {
  return Math.max(0.35, 0.95 - night * 0.05);
}

// Where the road starts and ends each night. The gate and the beacon drift
// a little so no two nights share the same road.
export function gateRow(night) {
  return [5, 3, 7, 4, 6, 2, 8, 5, 3, 6][(night - 1) % 10];
}

export function beaconRow(night) {
  return [4, 6, 3, 7, 5, 8, 2, 4, 6, 5][(night - 1) % 10];
}

// Boons offered between nights. Each has an id, a title and a line of text.
export const BOONS = [
  { id: 'mend', title: 'Mend the Beacon', text: 'Heal the beacon +8.', apply: (s) => { s.beaconHp = Math.min(s.beaconMax, s.beaconHp + 8); } },
  { id: 'purse', title: 'Found Purse', text: 'Gain 30 embers now.', apply: (s) => { s.embers += 30; } },
  { id: 'sharpen', title: 'Sharpened Flames', text: 'Lanterns +10% damage.', apply: (s) => { s.mods.damage += 0.1; } },
  { id: 'far', title: 'Tall Lanterns', text: 'Lanterns +10% range.', apply: (s) => { s.mods.range += 0.1; } },
  { id: 'free-road', title: 'Cobblestone Gift', text: 'Next road is free.', apply: (s) => { s.mods.freePaveNext = true; } },
  { id: 'chill', title: 'Deep Winter', text: 'Frost slows 15% more.', apply: (s) => { s.mods.slow += 0.15; } },
  { id: 'quick', title: 'Quick Hands', text: 'Fire 10% faster.', apply: (s) => { s.mods.rate += 0.1; } },
  { id: 'stone', title: 'Stone Lanterns', text: 'Tough lanterns.', apply: (s) => { s.mods.towerArmor += 0.5; } },
];

export function rollBoons(rng, count = 3) {
  return rng.shuffle(BOONS).slice(0, count);
}
