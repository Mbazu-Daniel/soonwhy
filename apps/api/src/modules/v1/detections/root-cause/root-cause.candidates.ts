
import type {
  RootCauseCandidate,
  SignalScores,
  SignalEvidence,
} from './root-cause.types';

interface Finding {
  id: string;
  type: string;
  serviceName: string;
  operationName?: string;
  traceId?: string;
  timestamp: string;
  severity?: 'warning' | 'critical';
  observedValue?: number;
  baselineValue?: number;
  threshold?: number;
  data?: Record<string, unknown>;
}

interface DependencyInfo {
  upstream: string[];
  downstream: string[];
}

export class CandidateGenerator {
  generateFromFindings(findings: Finding[]): RootCauseCandidate[] {
    const serviceFindings = this.groupByService(findings);

    const serviceCandidates = Object.entries(serviceFindings).map(([serviceName, findings]) =>
      this.generateServiceCandidate(serviceName, findings),
    );

    const operationCandidates = this.generateOperationCandidates(findings);

    return [...serviceCandidates, ...operationCandidates];
  }

  private groupByService(findings: Finding[]): Record<string, Finding[]> {
    const grouped: Record<string, Finding[]> = {};
    for (const finding of findings) {
      if (!grouped[finding.serviceName]) {
        grouped[finding.serviceName] = [];
      }
      grouped[finding.serviceName]!.push(finding);
    }
    return grouped;
  }

  private generateServiceCandidate(serviceName: string, findings: Finding[]): RootCauseCandidate {
    const traceIds = [...new Set(findings.map((f) => f.traceId).filter(Boolean))];
    const timeWindow = this.calculateTimeWindow(findings);

    const anomalyData = this.extractAnomalyData(findings);

    return {
      id: `candidate-${serviceName}-${Date.now()}`,
      serviceName,
      candidateType: 'service',
      findingIds: findings.map((f) => f.id),
      traceIds,
      dependencies: {
        upstream: [],
        downstream: [],
      },
      timeWindow,
      anomalyData,
    };
  }

  private generateOperationCandidates(findings: Finding[]): RootCauseCandidate[] {
    const candidates: RootCauseCandidate[] = [];

    for (const finding of findings) {
      if (finding.operationName) {
        candidates.push({
          id: `candidate-${finding.serviceName}-${finding.operationName}-${Date.now()}`,
          serviceName: finding.serviceName,
          operationName: finding.operationName,
          candidateType: 'operation',
          findingIds: [finding.id],
          traceIds: finding.traceId ? [finding.traceId] : [],
          dependencies: {
            upstream: [],
            downstream: [],
          },
          timeWindow: {
            start: finding.timestamp,
            end: finding.timestamp,
          },
          anomalyData: {
            observedValue: finding.observedValue,
            baselineValue: finding.baselineValue,
            percentageDeviation: finding.observedValue && finding.baselineValue
              ? ((finding.observedValue - finding.baselineValue) / finding.baselineValue) * 100
              : undefined,
            severity: finding.severity,
          },
        });
      }
    }

    return candidates;
  }

  private calculateTimeWindow(findings: Finding[]): { start: string; end: string } {
    const timestamps = findings.map((f) => new Date(f.timestamp).getTime());
    const start = new Date(Math.min(...timestamps)).toISOString();
    const end = new Date(Math.max(...timestamps)).toISOString();
    return { start, end };
  }

  private extractAnomalyData(findings: Finding[]): RootCauseCandidate['anomalyData'] {
    const anomalyData: RootCauseCandidate['anomalyData'] = {};

    for (const finding of findings) {
      if (finding.observedValue !== undefined) {
        anomalyData.observedValue = finding.observedValue;
      }
      if (finding.baselineValue !== undefined) {
        anomalyData.baselineValue = finding.baselineValue;
      }
      if (finding.observedValue && finding.baselineValue) {
        anomalyData.percentageDeviation =
          ((finding.observedValue - finding.baselineValue) / finding.baselineValue) * 100;
      }
      if (finding.severity) {
        anomalyData.severity = finding.severity;
      }
      if (finding.severity === 'critical') {
        anomalyData.severity = 'critical';
      }
    }

    return anomalyData;
  }

  enrichWithDependencies(
    candidates: RootCauseCandidate[],
    dependencyMap: Map<string, DependencyInfo>,
  ): RootCauseCandidate[] {
    return candidates.map((candidate) => {
      const deps = dependencyMap.get(candidate.serviceName) || {
        upstream: [],
        downstream: [],
      };
      return {
        ...candidate,
        dependencies: deps,
      };
    });
  }
}
