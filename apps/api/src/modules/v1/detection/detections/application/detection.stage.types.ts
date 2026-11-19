import type { QuickwitService } from '@soonwhy/shared';
import type { DetectorSettingsService } from '../../detector-settings/application/detector-settings.service';
import type { DetectionEvidence } from '../../../../../common/db/schema/findings';
import type { DetectionFinding, FindingSeverity, FindingType } from '../domain/detection.types';

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
