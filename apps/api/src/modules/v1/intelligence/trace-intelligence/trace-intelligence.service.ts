import { Injectable } from "@nestjs/common";
import type { Trace, CriticalPathAnalysis, TraceFinding } from "./trace-intelligence.types";
import { analyzeCriticalPath, compareTraces } from "./trace-analyzer";
import { createTelemetryIdentity } from "@soonwhy/shared";

@Injectable()
export class TraceIntelligenceService {
  analyzeCriticalPath(trace: Trace): CriticalPathAnalysis {
    return analyzeCriticalPath(trace);
  }

  compareTraces(before: Trace, after: Trace) {
    return compareTraces(before, after);
  }

  generateFindings(analysis: CriticalPathAnalysis): TraceFinding[] {
    const findings: TraceFinding[] = [];

    if (analysis.dominantSpanContribution > 50) {
      findings.push({
        identity: createTelemetryIdentity({
          domain: "trace",
          serviceName: analysis.dominantSpan.serviceName,
          operationName: analysis.dominantSpan.operationName,
          resourceName: analysis.traceId,
        }),
        findingType: "dominant_span",
        severity: analysis.dominantSpanContribution > 70 ? "critical" : "warning",
        evidence: [
          `Dominant span: ${analysis.dominantSpan.serviceName}:${analysis.dominantSpan.operationName}`,
          `Contribution: ${analysis.dominantSpanContribution.toFixed(1)}%`,
          `Duration: ${analysis.dominantSpan.durationMs}ms`,
        ],
        confidence: 0.95,
        correlation: {
          traceId: analysis.traceId,
          serviceName: analysis.dominantSpan.serviceName,
        },
      });
    }

    if (analysis.slowChildSpans.length > 0) {
      for (const child of analysis.slowChildSpans) {
        findings.push({
          identity: createTelemetryIdentity({
            domain: "trace",
            serviceName: child.serviceName,
            operationName: child.operationName,
            resourceName: analysis.traceId,
          }),
          findingType: "slow_child",
          severity: "warning",
          evidence: [
            `Slow child span: ${child.serviceName}:${child.operationName}`,
            `Duration: ${child.durationMs}ms`,
          ],
          confidence: 0.85,
          correlation: {
            traceId: analysis.traceId,
            serviceName: child.serviceName,
          },
        });
      }
    }

    if (analysis.repeatedSpans.length > 0) {
      for (const repeated of analysis.repeatedSpans) {
        findings.push({
          identity: createTelemetryIdentity({
            domain: "trace",
            serviceName: repeated.serviceName,
            operationName: repeated.operationName,
            resourceName: analysis.traceId,
          }),
          findingType: "repeated_spans",
          severity: repeated.totalContribution > 30 ? "warning" : "info",
          evidence: [
            `Repeated operation: ${repeated.serviceName}:${repeated.operationName}`,
            `Count: ${repeated.count}`,
            `Total contribution: ${repeated.totalContribution.toFixed(1)}%`,
          ],
          confidence: 0.9,
          correlation: {
            traceId: analysis.traceId,
            serviceName: repeated.serviceName,
          },
        });
      }
    }

    if (analysis.dependencyBottlenecks.length > 0) {
      for (const bottleneck of analysis.dependencyBottlenecks) {
        findings.push({
          identity: createTelemetryIdentity({
            domain: "trace",
            serviceName: bottleneck.serviceName,
            operationName: bottleneck.operationName,
            resourceName: analysis.traceId,
          }),
          findingType: "dependency_bottleneck",
          severity: bottleneck.isCritical ? "critical" : "warning",
          evidence: [
            `Dependency bottleneck: ${bottleneck.serviceName}:${bottleneck.operationName}`,
            `Type: ${bottleneck.dependencyType}`,
            `Contribution: ${bottleneck.contributionPercent.toFixed(1)}%`,
            `Latency: ${bottleneck.avgLatencyMs}ms`,
          ],
          confidence: 0.9,
          correlation: {
            traceId: analysis.traceId,
            serviceName: bottleneck.serviceName,
          },
        });
      }
    }

    if (analysis.errorLocation) {
      findings.push({
        identity: createTelemetryIdentity({
          domain: "trace",
          serviceName: analysis.errorLocation.serviceName,
          operationName: analysis.errorLocation.operationName,
          resourceName: analysis.traceId,
        }),
        findingType: "error_location",
        severity: "critical",
        evidence: [
          `Error in span: ${analysis.errorLocation.serviceName}:${analysis.errorLocation.operationName}`,
          `Duration: ${analysis.errorLocation.durationMs}ms`,
        ],
        confidence: 1.0,
        correlation: {
          traceId: analysis.traceId,
          serviceName: analysis.errorLocation.serviceName,
        },
      });
    }

    return findings;
  }
}
