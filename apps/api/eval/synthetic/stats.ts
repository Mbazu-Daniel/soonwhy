import { BOOTSTRAP_ITERATIONS, BOOTSTRAP_SEED, WILSON_Z } from "./constants";
import { createRandom } from "./rng";
import type { Interval } from "./types";

export function wilson(successes: number, total: number): Interval {
  if (total === 0) return { value: 0, low: 0, high: 0 };
  const p = successes / total;
  const z2 = WILSON_Z * WILSON_Z;
  const denominator = 1 + z2 / total;
  const centre = (p + z2 / (2 * total)) / denominator;
  const margin = (WILSON_Z * Math.sqrt((p * (1 - p)) / total + z2 / (4 * total * total))) / denominator;
  return { value: p, low: Math.max(0, centre - margin), high: Math.min(1, centre + margin) };
}

export function reciprocalRank(rank: number | null): number {
  return rank === null ? 0 : 1 / rank;
}

export function mean(values: number[]): number {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function pairedBootstrap(first: number[], second: number[]): Interval {
  if (first.length !== second.length) throw new Error("paired samples must have equal length");
  const differences = first.map((value, index) => value - second[index]!);
  if (differences.length === 0) return { value: 0, low: 0, high: 0 };
  const random = createRandom(BOOTSTRAP_SEED);
  const means: number[] = [];
  for (let iteration = 0; iteration < BOOTSTRAP_ITERATIONS; iteration++) {
    let sum = 0;
    for (let draw = 0; draw < differences.length; draw++) sum += differences[Math.floor(random() * differences.length)]!;
    means.push(sum / differences.length);
  }
  means.sort((a, b) => a - b);
  return { value: mean(differences), low: means[Math.floor(0.025 * means.length)]!, high: means[Math.floor(0.975 * means.length)]! };
}
