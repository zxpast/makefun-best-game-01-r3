// Seeded random numbers for ROADWARD. One generator, one stream: the same
// seed always deals the same nights, so a game can be replayed exactly and
// the autopilot can prove a win in Node without a browser.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeRng(seed) {
  const next = mulberry32(seed);
  return {
    next,
    // integer in [0, n)
    int(n) {
      return Math.floor(next() * n);
    },
    // float in [min, max)
    range(min, max) {
      return min + next() * (max - min);
    },
    // pick one element
    pick(list) {
      return list[Math.floor(next() * list.length)];
    },
    // Fisher-Yates, returns a new shuffled array
    shuffle(list) {
      const out = list.slice();
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        const tmp = out[i];
        out[i] = out[j];
        out[j] = tmp;
      }
      return out;
    },
  };
}
