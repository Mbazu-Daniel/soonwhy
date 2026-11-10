import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
import { QUICKWIT_INDEXES, QuickwitService } from '@soonwhy/shared';
import { DetectorSettingsService } from '../detector-settings/detector-settings.service';
import { DetectionTelemetryService } from './detection-telemetry.service';
import { db } from '../../../common/db';
import { findings } from '../../../common/db/schema/findings';
import { quickwitTenantQuery, quickwitTerm } from '../../../common/quickwit/query';
import { completeDetectionRun, enqueueDetectionRun, failDetectionRun, startDetectionRun, claimQueuedDetectionRun } from './detection.run';
import { recordDetectionRun } from '../../../common/telemetry/otel-metrics';
import type { DetectionFinding } from './detection.types';
import { ProjectsRepository } from '../projects/projects.repository';
import { DetectionPipeline } from './detection.pipeline';
import { WINDOW_MS } from './detection.stage';

@Injectable()
export class DetectionService {
  constructor(
    private readonly pipeline: DetectionPipeline,
    private readonly quickwit: QuickwitService,
    private readonly projectsRepository: ProjectsRepository,
    private readonly detectorSettings: DetectorSettingsService,
    private readonly detectionTelemetry: DetectionTelemetryService,
  ) {}

  async run(orgId: string, projectId: string): Promise<DetectionFinding[]> {
    const settings = await this.detectorSettings.get(orgId);
    if (!this.detectorSettings.featureEnabled(settings, 'detections.enabled')) {
      throw new ForbiddenException('Detections are disabled for this organisation');
    }

    await this.assertProjectAccess(orgId, projectId);
    const end = new Date();
    const start = new Date(end.getTime() - WINDOW_MS);
    const run = await startDetectionRun(orgId, projectId, start, end);

    return this.processDetectionRun({
      id: run.id,
      orgId,
      projectId,
      windowStart: start,
      windowEnd: end,
    }, settings);
  }

  async enqueue(
    orgId: string,
    projectId: string,
  ): Promise<{ id: string; status: 'queued'; windowStart: Date; windowEnd: Date }> {
    const settings = await this.detectorSettings.get(orgId);
    if (!this.detectorSettings.featureEnabled(settings, 'detections.enabled')) {
      throw new ForbiddenException('Detections are disabled for this organisation');
    }
    if (!this.detectorSettings.featureEnabled(settings, 'detections.async')) {
      throw new ForbiddenException('Async detection runs are disabled for this organisation');
    }

    await this.assertProjectAccess(orgId, projectId);
    const end = new Date();
    const start = new Date(end.getTime() - WINDOW_MS);
    const run = await enqueueDetectionRun(orgId, projectId, start, end);

    return {
      id: run.id,
      status: 'queued',
      windowStart: start,
      windowEnd: end,
    };
  }

  async claimAndRunOne(): Promise<string | undefined> {
    const claimed = await claimQueuedDetectionRun();
    if (!claimed) return undefined;

    const settings = await this.detectorSettings.get(claimed.orgId);
    await this.assertProjectAccess(claimed.orgId, claimed.projectId);
    await this.processDetectionRun(claimed, settings);
    return claimed.id;
  }

  private async processDetectionRun(
    run: { id: string; orgId: string; projectId: string; windowStart: Date; windowEnd: Date },
    settings: Awaited<ReturnType<DetectorSettingsService['get']>>,
  ): Promise<DetectionFinding[]> {
    const startedAt = Date.now();
    await this.detectionTelemetry.runStarted({
      orgId: run.orgId,
      projectId: run.projectId,
      runId: run.id,
      windowStart: run.windowStart,
      windowEnd: run.windowEnd,
    });

    try {
      const findings = await this.pipeline.execute(
        run.orgId,
        run.projectId,
        run.windowStart,
        run.windowEnd,
        settings,
      );
      await completeDetectionRun(run.id, findings.length);
      recordDetectionRun('success', Date.now() - startedAt);
      await this.detectionTelemetry.runCompleted({
        orgId: run.orgId,
        projectId: run.projectId,
        runId: run.id,
        findingsCount: findings.length,
        durationMs: Date.now() - startedAt,
        windowStart: run.windowStart,
        windowEnd: run.windowEnd,
      });
      return findings;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Detection failed';
      await failDetectionRun(run.id, message);
      recordDetectionRun('failure', Date.now() - startedAt);
      await this.detectionTelemetry.runFailed({
        orgId: run.orgId,
        projectId: run.projectId,
        runId: run.id,
        error,
        durationMs: Date.now() - startedAt,
        windowStart: run.windowStart,
        windowEnd: run.windowEnd,
      });
      throw error;
    } finally {
      await this.detectionTelemetry.flush();
    }
  }

  async telemetry(orgId: string, projectId: string) {
    const settings = await this.detectorSettings.get(orgId);
    if (!this.detectorSettings.featureEnabled(settings, 'detections.telemetry')) {
      return {
        configured: false,
        detections: [],
        runs: [],
        recent: [],
        stats: { buffered: 0, published: 0, dropped: 0, batches: 0 },
      };
    }

    const endTimestamp = Math.floor(Date.now() / 1000);
    const startTimestamp = endTimestamp - 3_600;

    const [detections, runs] = await Promise.all([
      this.searchDetections(orgId, projectId, startTimestamp, endTimestamp),
      this.searchDetectionRuns(orgId, projectId, startTimestamp, endTimestamp),
    ]);

    return {
      configured: true,
      windowStart: new Date(startTimestamp * 1000).toISOString(),
      windowEnd: new Date(endTimestamp * 1000).toISOString(),
      detections,
      runs,
      recent: runs.flatMap((run) => {
        if (run.kind !== 'run_completed' && run.kind !== 'run_failed') return [];
        return [
          {
            runId: run.runId,
            kind: run.kind,
            completedAt: run.timestamp,
            findingsCount: run.findingsCount ?? 0,
            durationMs: run.durationMs ?? null,
            error: run.error ?? null,
          },
        ];
      }),
      stats: detections.length > 0 ? { detections: detections.length, runs: runs.length } : { detections: 0, runs: runs.length },
    };
  }

  private async searchDetections(
    orgId: string,
    projectId: string,
    startTimestamp: number,
    endTimestamp: number,
  ) {
    const result = await this.quickwit.search<Record<string, unknown>>(QUICKWIT_INDEXES.detections, {
      query: quickwitTenantQuery(orgId, projectId, quickwitTerm('kind', 'finding')),
      startTimestamp,
      endTimestamp,
      maxHits: 500,
      sortBy: ['-timestamp'],
    });

    return (result.hits ?? []).flatMap((hit) => {
      const source = hit._source as Record<string, unknown> | undefined;
      if (!source) return [];
      return [
        {
          eventId: String(source.eventId ?? ''),
          kind: String(source.kind ?? ''),
          detector: String(source.detector ?? ''),
          findingId: String(source.findingId ?? ''),
          runId: String(source.runId ?? ''),
          service: String(source.service ?? ''),
          type: String(source.type ?? ''),
          severity: String(source.severity ?? ''),
          title: String(source.title ?? ''),
          observedValue: typeof source.observedValue === 'number' ? source.observedValue : null,
          threshold: typeof source.threshold === 'number' ? source.threshold : null,
          unit: String(source.unit ?? ''),
          windowStart: source.windowStart,
          windowEnd: source.windowEnd,
          timestamp: source.timestamp,
        },
      ];
    });
  }

  private async searchDetectionRuns(
    orgId: string,
    projectId: string,
    startTimestamp: number,
    endTimestamp: number,
  ) {
    const result = await this.quickwit.search<Record<string, unknown>>(QUICKWIT_INDEXES.detections, {
      query: quickwitTenantQuery(orgId, projectId, 'kind:(run_started OR run_completed OR run_failed)'),
      startTimestamp,
      endTimestamp,
      maxHits: 500,
      sortBy: ['-timestamp'],
    });

    return (result.hits ?? []).flatMap((hit) => {
      const source = hit._source as Record<string, unknown> | undefined;
      if (!source) return [];
      return [
        {
          eventId: String(source.eventId ?? ''),
          kind: String(source.kind ?? ''),
          status: String(source.status ?? ''),
          runId: String(source.runId ?? ''),
          findingsCount: typeof source.findingsCount === 'number' ? source.findingsCount : null,
          durationMs: typeof source.durationMs === 'number' ? source.durationMs : null,
          error: String(source.error ?? ''),
          windowStart: source.windowStart,
          windowEnd: source.windowEnd,
          timestamp: source.timestamp,
        },
      ];
    });
  }

  async list(orgId: string, projectId: string, limit = 50) {
    await this.assertProjectAccess(orgId, projectId);

    return db
      .select()
      .from(findings)
      .where(and(eq(findings.orgId, orgId), eq(findings.projectId, projectId)))
      .orderBy(desc(findings.detectedAt))
      .limit(Math.min(Math.max(limit, 1), 100));
  }

  private async assertProjectAccess(orgId: string, projectId: string): Promise<void> {
    const project = await this.projectsRepository.getProjectById(projectId, orgId);
    if (!project) throw new NotFoundException('Project not found');
  }
}
