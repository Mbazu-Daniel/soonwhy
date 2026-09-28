import type { EvidenceObservation, EvidenceWindow } from './evidence.types';
import type { TelemetryIdentity } from './telemetry-identity.types';

export interface EvidenceConfidenceInput {
  identity: TelemetryIdentity;
  observations: EvidenceObservation[];
  windows: EvidenceWindow[];
  requiredWindows?: number;
  minimumObservations?: number;
  minimumIndependentSources?: number;
}

export interface EvidenceConfidence {
  identity: TelemetryIdentity;
  score: number;
  status: 'candidate' | 'supported' | 'confirmed';
  observationCount: number;
  windowCount: number;
  independentSourceCount: number;
}

export interface EvidenceConfidenceWeights {
  repeatedWindows: number;
  observationDepth: number;
  sourceDiversity: number;
}

export const DEFAULT_CONFIDENCE_WEIGHTS: EvidenceConfidenceWeights = {
  repeatedWindows: 0.5,
  observationDepth: 0.25,
  sourceDiversity: 0.25,
};

export function evaluateEvidenceConfidence(
  input: EvidenceConfidenceInput,
  weights: EvidenceConfidenceWeights = DEFAULT_CONFIDENCE_WEIGHTS,
): EvidenceConfidence {
  const requiredWindows = Math.max(1, input.requiredWindows ?? 3);
  const minimumObservations = Math.max(1, input.minimumObservations ?? 5);
  const minimumIndependentSources = Math.max(1, input.minimumIndependentSources ?? 2);
  const validWindows = uniqueValidWindows(input.windows);
  const observationCount = input.observations.length;
  const windowCount = validWindows.size;
  const independentSourceCount = new Set(input.observations.map((item) => item.source)).size;

  const windowScore = Math.min(windowCount / requiredWindows, 1);
  const observationScore = Math.min(observationCount / minimumObservations, 1);
  const sourceScore = Math.min(independentSourceCount / minimumIndependentSources, 1);
  const score = clamp(
    windowScore * weights.repeatedWindows +
      observationScore * weights.observationDepth +
      sourceScore * weights.sourceDiversity,
  );

  let status: EvidenceConfidence['status'] = 'candidate';

  if (
    windowCount >= requiredWindows &&
    observationCount >= minimumObservations &&
    independentSourceCount >= minimumIndependentSources
  ) {
    status = score >= 0.9 ? 'confirmed' : 'supported';
  } else if (score >= 0.5) {
    status = 'supported';
  }

  return {
    identity: input.identity,
    score,
    status,
    observationCount,
    windowCount,
    independentSourceCount,
  };
}

function uniqueValidWindows(windows: EvidenceWindow[]): Set<string> {
  return new Set(
    windows
      .filter((window) => window.start < window.end)
      .map((window) => `${window.start}:${window.end}`),
  );
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}
