import type { QuickwitService } from '@soonwhy/shared';
import type { DetectorSettingsService } from '../detector-settings/detector-settings.service';
import type { DetectionEvidence } from '../../../common/db/schema/findings';
import type { DetectionFinding, FindingSeverity, FindingType } from './detection.types';

export const WINDOW_MS = 15 * 60_000;

export type DetectorSettings = Awaited<ReturnType<DetectorSettingsService['get']>>;

export type DetectionStageContext = {
  orgId: string;
  projectId: string;
  start: Date;
  end: Date;
  startTimestamp: number;
  endTimestamp: number;
  settings: DetectorSettings;
  detectorEnabled: (key: string) => boolean;
};

export type FindingDraft = {
  orgId: string;
  projectId: string;
  serviceName: string;
  detector?: string;
  type: FindingType;
  severity: FindingSeverity;
  title: string;
  description: string;
  observedValue: number;
  threshold: number;
  unit: string;
  start: Date;
  end: Date;
  evidence: DetectionEvidence[];
  fingerprint?: string;
};

export type CachedQuery = <T>(
  label: string,
  orgId: string,
  projectId: string,
  startTimestamp: number,
  endTimestamp: number,
  load: () => Promise<T>,
) => Promise<T>;

export type DetectionStageDeps = {
  quickwit: QuickwitService;
  cachedQuery: CachedQuery;
  detectorSettings: DetectorSettingsService;
  persist: (input: FindingDraft) => Promise<DetectionFinding>;
};

export function detectorThresholds(
  detectorSettings: DetectorSettingsService,
  settings: DetectorSettings,
  detector: string,
  keys: string[],
): Record<string, number | undefined> {
  return Object.fromEntries(
    keys.map((key) => [key, detectorSettings.threshold(settings, detector, key)]),
  );
}
