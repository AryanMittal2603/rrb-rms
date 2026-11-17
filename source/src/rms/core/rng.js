// Deterministic pseudo-random numbers so every fresh demo starts from the same data.
export function rng(seed) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int(min, max) { return Math.floor(next() * (max - min + 1)) + min; },
    pick(list) { return list[Math.floor(next() * list.length)]; },
    chance(p) { return next() < p; },
    weighted(pairs) {
      let total = 0;
      for (let i = 0; i < pairs.length; i++) total += pairs[i][1];
      let r = next() * total;
      for (let i = 0; i < pairs.length; i++) { r -= pairs[i][1]; if (r <= 0) return pairs[i][0]; }
      return pairs[pairs.length - 1][0];
    },
    shuffle(list) {
      const a2 = list.slice();
      for (let i = a2.length - 1; i > 0; i--) { const j = Math.floor(next() * (i + 1)); const tmp = a2[i]; a2[i] = a2[j]; a2[j] = tmp; }
      return a2;
    },
  };
}
