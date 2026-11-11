import { Controller, Post, Body } from "@nestjs/common";
import { RuntimeIntelligenceService } from "./runtime-intelligence.service";
import type { RuntimeMetrics, RuntimeAggregation } from "./runtime-intelligence.types";

@Controller("intelligence/runtime")
export class RuntimeIntelligenceController {
  constructor(private readonly service: RuntimeIntelligenceService) {}

  @Post("cpu-spike")
  detectCpuSpike(@Body() body: { metrics: RuntimeMetrics }) {
    return this.service.detectCpuSpike(body.metrics);
  }

  @Post("memory-pressure")
  detectMemoryPressure(@Body() body: { metrics: RuntimeMetrics }) {
    return this.service.detectMemoryPressure(body.metrics);
  }

  @Post("event-loop-lag")
  detectEventLoopLag(@Body() body: { metrics: RuntimeMetrics }) {
    return this.service.detectEventLoopLag(body.metrics);
  }

  @Post("gc-pressure")
  detectGcPressure(@Body() body: { metrics: RuntimeMetrics }) {
    return this.service.detectGcPressure(body.metrics);
  }

  @Post("resource-exhaustion")
  detectResourceExhaustion(@Body() body: { metrics: RuntimeMetrics }) {
    return this.service.detectResourceExhaustion(body.metrics);
  }

  @Post("aggregate")
  aggregateMetrics(@Body() body: { metrics: RuntimeMetrics[] }) {
    return this.service.aggregateMetrics(body.metrics);
  }

  @Post("regression")
  detectRegression(
    @Body()
    body: {
      current: RuntimeAggregation;
      baseline: RuntimeAggregation;
      options?: {
        cpuThreshold?: number;
        memoryThreshold?: number;
        eventLoopThreshold?: number;
      };
    },
  ) {
    return this.service.detectRegression(
      body.current,
      body.baseline,
      body.options,
    );
  }
}
