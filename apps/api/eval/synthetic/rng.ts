import { HASH_MULTIPLIER } from "./constants";

export type Random = () => number;

export function createRandom(seed: number): Random {
  let state = seed | 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashLabel(label: string): number {
  let hash = 0;
  for (const char of label) hash = (Math.imul(hash, HASH_MULTIPLIER) + char.charCodeAt(0)) | 0;
  return hash >>> 0;
}
