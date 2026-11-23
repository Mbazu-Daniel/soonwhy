import { TOPOLOGIES } from "./topologies";
import { SCENARIOS } from "./scenarios";
import type { ScenarioDef, Split, Topology } from "./types";

const listOf = (value: string | undefined): string[] | undefined => (value ? value.split(",").map((item) => item.trim()) : undefined);

export function selectedTopologies(value = process.env.EVAL_TOPOLOGY): Topology[] {
  const names = listOf(value);
  return names ? TOPOLOGIES.filter((topology) => names.includes(topology.name)) : TOPOLOGIES;
}

export function selectedScenarios(value = process.env.EVAL_SCENARIOS): ScenarioDef[] {
  const names = listOf(value);
  return names ? SCENARIOS.filter((scenario) => names.includes(scenario.name)) : SCENARIOS;
}

export function selectedSplit(value = process.env.EVAL_SPLIT): Split | "all" {
  if (value === "locked" || value === "all") return value;
  return "tuning";
}

export function maxReps(value = process.env.EVAL_MAX_REPS): number {
  return value ? Number(value) : Number.POSITIVE_INFINITY;
}

export function controlReps(fallback: number, value = process.env.EVAL_CONTROL_REPS): number {
  return value ? Number(value) : fallback;
}
