/**
 * Seeded PRNG (mulberry32) — deterministic, never Math.random, so every
 * simulated run and every test using it is reproducible.
 *
 * A separate, independent copy of the same small algorithm used by
 * src/data/seedActivity.ts. That file is frontend-owned and untouched by
 * the backend work; this one belongs to the movement pipeline.
 */
export function mulberry32(seed: number): () => number {
  let state = seed;
  return function next(): number {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
