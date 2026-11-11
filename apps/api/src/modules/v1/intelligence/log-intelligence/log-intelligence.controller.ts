import { Controller, Post, Body } from "@nestjs/common";
import { LogIntelligenceService } from "./log-intelligence.service";
import type { LogEntry, LogCorrelation, LogPattern, LogAnomaly, LogTraceFinding } from "./log-intelligence.types";

@Controller("intelligence/logs")
export class LogIntelligenceController {
  constructor(private readonly logService: LogIntelligenceService) {}

  @Post("correlate-to-trace")
  correlateToTrace(
    @Body()
    body: {
      logs: LogEntry[];
      traceId: string;
      timeWindowMs?: number;
    },
  ): LogCorrelation {
    return this.logService.correlateLogsToTrace(
      body.logs,
      body.traceId,
      body.timeWindowMs,
    );
  }

  @Post("find-patterns")
  findPatterns(
    @Body()
    body: {
      logs: LogEntry[];
      minCount?: number;
    },
  ): LogPattern[] {
    return this.logService.findLogPatterns(body.logs, body.minCount);
  }

  @Post("detect-anomalies")
  detectAnomalies(
    @Body()
    body: {
      logs: LogEntry[];
      baselineLogsPerMinute: number;
      baselineErrorRate: number;
    },
  ): LogAnomaly[] {
    return this.logService.detectLogAnomalies(
      body.logs,
      body.baselineLogsPerMinute,
      body.baselineErrorRate,
    );
  }

  @Post("find-around-trace")
  findAroundTrace(
    @Body()
    body: {
      logs: LogEntry[];
      traceStartTime: string;
      traceDurationMs: number;
      windowMs?: number;
    },
  ): LogEntry[] {
    return this.logService.findLogsAroundTrace(
      body.logs,
      body.traceStartTime,
      body.traceDurationMs,
      body.windowMs,
    );
  }

  @Post("findings")
  generateFindings(@Body() correlation: LogCorrelation): LogTraceFinding[] {
    return this.logService.generateFindings(correlation);
  }
}
