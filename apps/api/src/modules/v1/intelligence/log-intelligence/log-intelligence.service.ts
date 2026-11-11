import { Injectable } from "@nestjs/common";
import type {
  LogEntry,
  LogCorrelation,
  LogPattern,
  LogAnomaly,
  LogTraceFinding,
} from "./log-intelligence.types";
import {
  correlateLogsToTrace,
  findLogPatterns,
  detectLogAnomalies,
  findLogsAroundTrace,
} from "./log-correlator";
import { createTelemetryIdentity } from "@soonwhy/shared";

@Injectable()
export class LogIntelligenceService {
  correlateLogsToTrace(
    logs: LogEntry[],
    traceId: string,
    timeWindowMs?: number,
  ): LogCorrelation {
    return correlateLogsToTrace(logs, traceId, timeWindowMs);
  }

  findLogPatterns(logs: LogEntry[], minCount?: number): LogPattern[] {
    return findLogPatterns(logs, minCount);
  }

  detectLogAnomalies(
    logs: LogEntry[],
    baselineLogsPerMinute: number,
    baselineErrorRate: number,
  ): LogAnomaly[] {
    return detectLogAnomalies(logs, baselineLogsPerMinute, baselineErrorRate);
  }

  findLogsAroundTrace(
    logs: LogEntry[],
    traceStartTime: string,
    traceDurationMs: number,
    windowMs?: number,
  ): LogEntry[] {
    return findLogsAroundTrace(logs, traceStartTime, traceDurationMs, windowMs);
  }

  generateFindings(correlation: LogCorrelation): LogTraceFinding[] {
    const findings: LogTraceFinding[] = [];

    if (correlation.errorLogs.length > 0) {
      for (const errorLog of correlation.errorLogs) {
        findings.push({
          identity: createTelemetryIdentity({
            domain: "error",
            serviceName: errorLog.serviceName,
            operationName: errorLog.level,
            resourceName: correlation.traceId,
          }),
          findingType: "error_in_trace",
          severity: "critical",
          evidence: [
            `Error in trace: ${errorLog.message}`,
            `Service: ${errorLog.serviceName || "unknown"}`,
            `Timestamp: ${errorLog.timestamp}`,
          ],
          confidence: 1.0,
          correlation: {
            traceId: correlation.traceId,
            spanId: errorLog.spanId,
            serviceName: errorLog.serviceName,
          },
        });
      }
    }

    if (correlation.warningLogs.length > 5) {
      findings.push({
        identity: createTelemetryIdentity({
          domain: "error",
          serviceName: correlation.warningLogs[0]?.serviceName,
          operationName: "warn",
          resourceName: correlation.traceId,
        }),
        findingType: "warning_pattern",
        severity: "warning",
        evidence: [
          `High warning count in trace: ${correlation.warningLogs.length}`,
          `Time window: ${correlation.timeWindow.start} to ${correlation.timeWindow.end}`,
        ],
        confidence: 0.85,
        correlation: {
          traceId: correlation.traceId,
        },
      });
    }

    const spanCount = correlation.logsBySpan.size;
    const logCount = correlation.logs.length;
    if (logCount > 0 && spanCount === 0) {
      findings.push({
        identity: createTelemetryIdentity({
          domain: "trace",
          serviceName: correlation.logs[0]?.serviceName,
          operationName: "log",
          resourceName: correlation.traceId,
        }),
        findingType: "missing_context",
        severity: "info",
        evidence: [
          `Logs lack span context for correlation`,
          `Log count: ${logCount}`,
          `Trace ID: ${correlation.traceId}`,
        ],
        confidence: 0.7,
        correlation: {
          traceId: correlation.traceId,
        },
      });
    }

    return findings;
  }
}
