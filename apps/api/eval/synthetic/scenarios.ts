import { BASELINE_SHIFT_FACTOR, CONTROL_RUNS_PER_CELL, NO_FAULT_RUNS_PER_TOPOLOGY, ORPHAN_RATE, REPS_PER_CASE } from "./constants";
import type { Benign, CaseSpec, Distortion, Fault, ScenarioDef, Topology } from "./types";

const CLEAN: Distortion = { sampleDrop: 0, skewMs: 0, orphanRate: 0 };
const PLAIN: Benign = { workScale: 1, noisy: false };

const callersOf = (topology: Topology, target: string): string[] =>
  Object.entries(topology.services)
    .filter(([, spec]) => spec.steps.some((step) => step.calls.some((edge) => edge.target === target)))
    .map(([name]) => name);

interface SingleFaultOptions {
  fault: Fault;
  distortion?: Distortion;
  retries?: number;
  absorb?: boolean;
}

function singleFault(name: string, options: SingleFaultOptions): ScenarioDef {
  return {
    name,
    reps: REPS_PER_CASE,
    build: (topology) =>
      topology.targets.map((target) => ({
        id: `${name}/${target}`,
        truth: [target],
        faults: { [target]: options.fault },
        absorbers: options.absorb ? callersOf(topology, target) : [],
        retries: options.retries ?? 0,
        distortion: options.distortion ?? CLEAN,
        benign: PLAIN,
      })),
  };
}

const twoFaults: ScenarioDef = {
  name: "two_faults",
  reps: REPS_PER_CASE,
  build: (topology) =>
    topology.pairs.map(([first, second]) => ({
      id: `two_faults/${first}+${second}`,
      truth: [first, second],
      faults: { [first]: { delayMs: 400 }, [second]: { errorRate: 0.3 } },
      absorbers: [],
      retries: 0,
      distortion: CLEAN,
      benign: PLAIN,
    })),
};

const control = (name: string, benign: Benign, reps: number): ScenarioDef => ({
  name,
  reps,
  build: () => [{ id: name, truth: [], faults: {}, absorbers: [], retries: 0, distortion: CLEAN, benign } satisfies CaseSpec],
});

const distort = (patch: Partial<Distortion>): Distortion => ({ ...CLEAN, ...patch });

export const FAULT_SCENARIOS: ScenarioDef[] = [
  singleFault("serial_delay", { fault: { delayMs: 400 } }),
  singleFault("error_rate", { fault: { errorRate: 0.4 } }),
  singleFault("contention", { fault: { spinMs: 300 } }),
  singleFault("fanout_delay", { fault: { delayMs: 500 } }),
  singleFault("cascading_retry", { fault: { errorRate: 0.5 }, retries: 2 }),
  twoFaults,
  singleFault("absorbed_error", { fault: { errorRate: 0.4 }, absorb: true }),
  singleFault("sampling_gap_20", { fault: { delayMs: 400 }, distortion: distort({ sampleDrop: 0.2 }) }),
  singleFault("sampling_gap_50", { fault: { delayMs: 400 }, distortion: distort({ sampleDrop: 0.5 }) }),
  singleFault("clock_skew_50ms", { fault: { delayMs: 400 }, distortion: distort({ skewMs: 50 }) }),
  singleFault("clock_skew_500ms", { fault: { delayMs: 400 }, distortion: distort({ skewMs: 500 }) }),
  singleFault("missing_parents", { fault: { errorRate: 0.4 }, distortion: distort({ orphanRate: ORPHAN_RATE }) }),
];

export const CONTROL_SCENARIOS: ScenarioDef[] = [
  control("no_fault", PLAIN, NO_FAULT_RUNS_PER_TOPOLOGY),
  control("baseline_shift", { workScale: BASELINE_SHIFT_FACTOR, noisy: false }, CONTROL_RUNS_PER_CELL),
  control("latency_noise", { workScale: 1, noisy: true }, CONTROL_RUNS_PER_CELL),
];

export const SCENARIOS: ScenarioDef[] = [...FAULT_SCENARIOS, ...CONTROL_SCENARIOS];
