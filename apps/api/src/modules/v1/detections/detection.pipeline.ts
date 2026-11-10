import { Injectable } from '@nestjs/common';
import { QuickwitService } from '@soonwhy/shared';
import { CacheService } from '../../../common/cache/cache.service';
import { CACHE_TTL_SECONDS } from '../../../common/cache/cache.constants';
import { DetectorSettingsService } from '../detector-settings/detector-settings.service';
import { DetectionTelemetryService } from './detection-telemetry.service';
import { db } from '../../../common/db';
import { findings, type DetectionEvidence } from '../../../common/db/schema/findings';
import { createIssueFromDetection } from '../intelligence/detection-issue.adapter';
import { IssueLifecycleService } from '../intelligence/issue-lifecycle.service';
import { recordDetectionFinding } from '../../../common/telemetry/otel-metrics';
import type { DetectionFinding, DetectionWindow, FindingSeverity, FindingType } from './detection.types';
import { type DetectionStageContext, type DetectionStageDeps } from './detection.stage';
import { detectServiceSignals } from './detection.service-signals';
import { detectEndpointSignals } from './detection.endpoint-signals';
import { detectDependencySignals } from './detection.dependency-signals';
import { detectDatabaseSignals } from './detection.database-signals';
import { detectTraceSignals } from './detection.trace-signals';
import { detectLockContentionSignals } from './detection.lock-contention-signals';
import { detectRuntimeSignals } from './detection.runtime-signals';

@Injectable()
export class DetectionPipeline {
  constructor(
    private readonly quickwit: QuickwitService,
    private readonly cache: CacheService,
    private readonly detectorSettings: DetectorSettingsService,
    private readonly detectionTelemetry: DetectionTelemetryService,
    private readonly issueLifecycleService: IssueLifecycleService,
  ) {}

  async execute(
    orgId: string,
    projectId: string,
    start: Date,
    end: Date,
    settings: Awaited<ReturnType<DetectorSettingsService['get']>>,
  ): Promise<DetectionFinding[]> {
    const detectorEnabled = (key: string) => this.detectorSettings.detectorEnabled(settings, key);
    const endTimestamp = Math.floor(end.getTime() / 1000);
    const startTimestamp = Math.floor(start.getTime() / 1000);

    const detected: DetectionFinding[] = [];
    const context: DetectionStageContext = {
      orgId, projectId, start, end, startTimestamp, endTimestamp, settings,
      detectorEnabled,
    };
    const deps = this.stageDeps();

    await detectServiceSignals(deps, context, detected);
    await detectEndpointSignals(deps, context, detected);
    await detectDependencySignals(deps, context, detected);
    const databaseSpans = await detectDatabaseSignals(deps, context, detected);
    await detectTraceSignals(deps, context, detected);
    await detectLockContentionSignals(deps, context, detected, databaseSpans);
    await detectRuntimeSignals(deps, context, detected);

    if (this.detectorSettings.featureEnabled(settings, 'detections.issue_lifecycles')) {
      await this.persistIssueLifecycles(orgId, projectId, detected);
    }
    return detected;
  }

  private stageDeps(): DetectionStageDeps {
    return {
      quickwit: this.quickwit,
      cachedQuery: (label, orgId, projectId, startTimestamp, endTimestamp, load) =>
        this.cachedQuery(label, orgId, projectId, startTimestamp, endTimestamp, load),
      detectorSettings: this.detectorSettings,
      persist: (input) => this.persistFinding(input),
    };
  }

  private async persistIssueLifecycles(
    orgId: string,
    projectId: string,
    findings: DetectionFinding[],
  ): Promise<void> {
    for (const finding of findings) {
      await this.issueLifecycleService.apply({
        orgId,
        projectId,
        issue: createIssueFromDetection(finding),
      });
    }
  }

  private async cachedQuery<T>(
    label: string,
    orgId: string,
    projectId: string,
    startTimestamp: number,
    endTimestamp: number,
    load: () => Promise<T>,
  ): Promise<T> {
    const settings = await this.detectorSettings.get(orgId);
    if (!this.detectorSettings.featureEnabled(settings, 'detections.cache')) {
      return load();
    }

    const key = ['detections', label, orgId, projectId, startTimestamp, endTimestamp].join(':');
    return this.cache.getOrSet(key, CACHE_TTL_SECONDS.detectionSearch, load);
  }

  private async persistFinding(input: {
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
  }): Promise<DetectionFinding> {
    const detector = input.detector ?? input.type;
    const result = await this.persistFindingRow({ ...input, detector });
    await this.detectionTelemetry.trackFinding({
      orgId: result.projectOrgId,
      projectId: result.projectId,
      findingId: result.id,
      detector,
      serviceName: result.serviceName,
      type: result.type,
      severity: result.severity,
      title: result.title,
      observedValue: result.observedValue,
      threshold: result.threshold,
      unit: result.unit,
      windowStart: result.window.start,
      windowEnd: result.window.end,
      fingerprint: input.fingerprint,
    });
    return result;
  }

  private async persistFindingRow(input: {
    orgId: string;
    projectId: string;
    serviceName: string;
    detector: string;
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
  }): Promise<DetectionFinding & { projectOrgId: string }> {
    const [row] = await db
      .insert(findings)
      .values({
        orgId: input.orgId,
        projectId: input.projectId,
        serviceName: input.serviceName,
        type: input.type,
        severity: input.severity,
        title: input.title,
        description: input.description,
        observedValue: input.observedValue,
        threshold: input.threshold,
        unit: input.unit,
        windowStart: input.start,
        windowEnd: input.end,
        evidence: input.evidence,
      })
      .returning();

    if (!row) throw new Error('Failed to persist detection finding');
    recordDetectionFinding(input.severity);

    return {
      id: row.id,
      projectId: row.projectId,
      projectOrgId: row.orgId,
      serviceName: row.serviceName,
      type: row.type as FindingType,
      severity: row.severity as FindingSeverity,
      title: row.title,
      description: row.description,
      observedValue: row.observedValue,
      threshold: row.threshold,
      unit: row.unit,
      window: {
        start: row.windowStart,
        end: row.windowEnd,
      } satisfies DetectionWindow,
      evidence: row.evidence,
    };
  }
}
