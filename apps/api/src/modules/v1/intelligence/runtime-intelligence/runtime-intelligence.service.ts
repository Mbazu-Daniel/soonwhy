import { Injectable } from "@nestjs/common";
import {
  detectCpuSpike,
  detectMemoryPressure,
  detectEventLoopLag,
  detectGcPressure,
  detectResourceExhaustion,
} from "./runtime-metrics-detector";
import { aggregateRuntimeMetrics, detectRuntimeRegression } from "./runtime-aggregator";
import type {
  RuntimeMetrics,
  RuntimeFinding,
  RuntimeAggregation,
  RuntimeRegression,
} from "./runtime-intelligence.types";

@Injectable()
export class RuntimeIntelligenceService {
  detectCpuSpike(metrics: RuntimeMetrics): RuntimeFinding | undefined {
    return detectCpuSpike(metrics);
  }

  detectMemoryPressure(metrics: RuntimeMetrics): RuntimeFinding | undefined {
    return detectMemoryPressure(metrics);
  }

  detectEventLoopLag(metrics: RuntimeMetrics): RuntimeFinding | undefined {
    return detectEventLoopLag(metrics);
  }

  detectGcPressure(metrics: RuntimeMetrics): RuntimeFinding | undefined {
    return detectGcPressure(metrics);
  }

  detectResourceExhaustion(metrics: RuntimeMetrics): RuntimeFinding | undefined {
    return detectResourceExhaustion(metrics);
  }

  aggregateMetrics(metrics: RuntimeMetrics[]): RuntimeAggregation {
    return aggregateRuntimeMetrics(metrics);
  }

  detectRegression(
    current: RuntimeAggregation,
    baseline: RuntimeAggregation,
    options?: {
      cpuThreshold?: number;
      memoryThreshold?: number;
      eventLoopThreshold?: number;
    },
  ): RuntimeRegression | undefined {
    return detectRuntimeRegression(
      current,
      baseline,
      options?.cpuThreshold,
      options?.memoryThreshold,
      options?.eventLoopThreshold,
    );
  }
}
