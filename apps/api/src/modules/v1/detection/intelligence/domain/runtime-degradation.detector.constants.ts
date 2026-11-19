import type { RuntimeMetricSpec } from "./runtime-degradation.detector.types";

export const MIN_SAMPLES = 5;

const RUNTIME_METRIC_SPECS: readonly RuntimeMetricSpec[] = [
  {
    family: "cpu",
    names: [
      "process.cpu.utilization",
      "system.cpu.utilization",
      "container.cpu.utilization",
    ],
    warning: 0.85,
    critical: 0.95,
    unit: "ratio",
  },
  {
    family: "memory",
    names: [
      "process.memory.utilization",
      "container.memory.utilization",
      "runtime.memory.utilization",
    ],
    warning: 0.9,
    critical: 0.98,
    unit: "ratio",
  },
  {
    family: "event_loop",
    names: ["nodejs.eventloop.utilization"],
    warning: 0.8,
    critical: 0.95,
    unit: "ratio",
  },
  {
    family: "event_loop_delay",
    names: ["nodejs.eventloop.delay.p95", "nodejs.eventloop.delay.p99"],
    warning: 0.1,
    critical: 0.5,
    unit: "s",
  },
];

export const SPEC_BY_METRIC_NAME = new Map(
  RUNTIME_METRIC_SPECS.flatMap((spec) =>
    spec.names.map((name) => [name, spec] as const),
  ),
);

export const RUNTIME_METRIC_NAMES: readonly string[] = Array.from(
  SPEC_BY_METRIC_NAME.keys(),
);
