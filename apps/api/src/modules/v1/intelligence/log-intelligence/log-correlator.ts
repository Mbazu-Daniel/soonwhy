import type { LogEntry, LogCorrelation, LogPattern, LogAnomaly, LogLevel } from "./log-intelligence.types";

export function correlateLogsToTrace(
  logs: LogEntry[],
  traceId: string,
  timeWindowMs: number = 60000,
): LogCorrelation {
  const traceLogs = logs.filter((log) => log.traceId === traceId);

  if (traceLogs.length === 0) {
    return {
      traceId,
      logs: [],
      logsBySpan: new Map(),
      errorLogs: [],
      warningLogs: [],
      timeWindow: {
        start: new Date().toISOString(),
        end: new Date().toISOString(),
      },
    };
  }

  const timestamps = traceLogs.map((log) => new Date(log.timestamp).getTime());
  const minTime = Math.min(...timestamps);
  const maxTime = Math.max(...timestamps);

  const windowLogs = traceLogs.filter((log) => {
    const logTime = new Date(log.timestamp).getTime();
    return logTime >= minTime && logTime <= maxTime + timeWindowMs;
  });

  const logsBySpan = new Map<string, LogEntry[]>();
  for (const log of windowLogs) {
    if (log.spanId) {
      const existing = logsBySpan.get(log.spanId) || [];
      existing.push(log);
      logsBySpan.set(log.spanId, existing);
    }
  }

  const errorLogs = windowLogs.filter((log) => log.level === "error" || log.level === "fatal");
  const warningLogs = windowLogs.filter((log) => log.level === "warn");

  return {
    traceId,
    logs: windowLogs,
    logsBySpan,
    errorLogs,
    warningLogs,
    timeWindow: {
      start: new Date(minTime).toISOString(),
      end: new Date(maxTime).toISOString(),
    },
  };
}

export function findLogPatterns(
  logs: LogEntry[],
  minCount: number = 3,
): LogPattern[] {
  const patterns = new Map<string, LogEntry[]>();

  for (const log of logs) {
    const normalized = normalizeLogMessage(log.message);
    const existing = patterns.get(normalized) || [];
    existing.push(log);
    patterns.set(normalized, existing);
  }

  const result: LogPattern[] = [];

  for (const [pattern, patternLogs] of patterns) {
    if (patternLogs.length >= minCount) {
      const services = new Set(patternLogs.map((log) => log.serviceName).filter(Boolean));
      const maxSeverity = getHighestSeverity(patternLogs);

      result.push({
        pattern,
        count: patternLogs.length,
        samples: patternLogs.slice(0, 5),
        severity: maxSeverity,
        services: Array.from(services) as string[],
      });
    }
  }

  return result.sort((a, b) => b.count - a.count);
}

export function detectLogAnomalies(
  logs: LogEntry[],
  baselineLogsPerMinute: number,
  baselineErrorRate: number,
): LogAnomaly[] {
  const anomalies: LogAnomaly[] = [];

  const timestamps = logs.map((log) => new Date(log.timestamp).getTime());
  const durationMs = Math.max(...timestamps) - Math.min(...timestamps) || 60000;
  const durationMinutes = durationMs / 60000;

  const currentLogsPerMinute = logs.length / durationMinutes;
  const volumeChange = (currentLogsPerMinute - baselineLogsPerMinute) / baselineLogsPerMinute;

  if (volumeChange > 2.0) {
    anomalies.push({
      anomalyType: "volume_spike",
      baselineValue: baselineLogsPerMinute,
      currentValue: currentLogsPerMinute,
      changePercent: volumeChange * 100,
      severity: volumeChange > 5.0 ? "critical" : "warning",
      evidence: [
        `Baseline: ${baselineLogsPerMinute.toFixed(0)} logs/min`,
        `Current: ${currentLogsPerMinute.toFixed(0)} logs/min`,
        `Duration: ${durationMinutes.toFixed(2)} minutes`,
      ],
      confidence: 0.9,
    });
  }

  const errorCount = logs.filter((log) => log.level === "error" || log.level === "fatal").length;
  const currentErrorRate = errorCount / logs.length;
  const errorRateChange = (currentErrorRate - baselineErrorRate) / (baselineErrorRate || 0.01);

  if (errorRateChange > 1.0) {
    anomalies.push({
      anomalyType: "error_rate_increase",
      baselineValue: baselineErrorRate * 100,
      currentValue: currentErrorRate * 100,
      changePercent: errorRateChange * 100,
      severity: errorRateChange > 3.0 ? "critical" : "warning",
      evidence: [
        `Baseline error rate: ${(baselineErrorRate * 100).toFixed(1)}%`,
        `Current error rate: ${(currentErrorRate * 100).toFixed(1)}%`,
        `Error count: ${errorCount}`,
      ],
      confidence: 0.95,
    });
  }

  return anomalies;
}

export function findLogsAroundTrace(
  logs: LogEntry[],
  traceStartTime: string,
  traceDurationMs: number,
  windowMs: number = 5000,
): LogEntry[] {
  const traceStart = new Date(traceStartTime).getTime();
  const traceEnd = traceStart + traceDurationMs;

  return logs.filter((log) => {
    const logTime = new Date(log.timestamp).getTime();
    return logTime >= traceStart - windowMs && logTime <= traceEnd + windowMs;
  });
}

function normalizeLogMessage(message: string): string {
  return message
    .replace(/\d+/g, "{number}")
    .replace(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/gi, "{uuid}")
    .replace(/\b[A-Fa-f0-9]{32}\b/g, "{hash}")
    .replace(/\b[A-Fa-f0-9]{40}\b/g, "{sha1}")
    .replace(/\b[A-Fa-f0-9]{64}\b/g, "{sha256}")
    .replace(/<[^>]+>/g, "{tag}")
    .replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, "{ip}")
    .replace(/https?:\/\/[^\s]+/g, "{url}")
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, "{email}")
    .trim();
}

function getHighestSeverity(logs: LogEntry[]): "debug" | "info" | "warn" | "error" | "fatal" {
  const severityOrder: LogLevel[] = ["debug", "info", "warn", "error", "fatal"];
  let highest: LogLevel = "debug";

  for (const log of logs) {
    const currentIndex = severityOrder.indexOf(log.level);
    const highestIndex = severityOrder.indexOf(highest);
    if (currentIndex > highestIndex) {
      highest = log.level;
    }
  }

  return highest;
}
