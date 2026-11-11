import type { DependencyCall, DependencyAggregation } from "./dependency-intelligence.types";
import { createTelemetryIdentity, fingerprintDependency } from "@soonwhy/shared";

export function aggregateDependencyCalls(
  calls: DependencyCall[],
): DependencyAggregation {
  if (calls.length === 0) {
    throw new Error("Cannot aggregate empty calls");
  }

  const first = calls[0];
  if (!first) {
    throw new Error("First call is undefined");
  }

  const identity = createTelemetryIdentity({
    domain: "dependency",
    serviceName: first.fromService,
    operationName: first.toService,
    resourceName: first.toService,
    identityAttributes: {
      dependencyType: first.dependencyType,
      target: first.toService,
    },
  });

  const sumLatency = calls.reduce((sum, c) => sum + c.latencyMs, 0);
  const errorCount = calls.filter((c) => c.error).length;

  return {
    identity,
    avgLatencyMs: sumLatency / calls.length,
    errorRate: errorCount / calls.length,
    callCount: calls.length,
  };
}
