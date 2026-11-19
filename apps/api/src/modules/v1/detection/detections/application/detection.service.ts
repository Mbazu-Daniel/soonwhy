import { Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
import { QuickwitService } from '@soonwhy/shared';
import { DetectorSettingsService } from '../../detector-settings/application/detector-settings.service';
import { db } from '../../../../../common/db';
import { findings } from '../../../../../common/db/schema/findings';
import { quickwitSource, quickwitTerm } from '../../../../../common/quickwit/query';
import type { RequestSource, TraceSource } from '../domain/detection.types';
import { ProjectsRepository } from '../../../identity/projects/infrastructure/projects.repository';
import { searchTenant } from '../../../../../common/telemetry/tenant-search';

@Injectable()
export class DetectionService {
  constructor(
    private readonly quickwit: QuickwitService,
    private readonly projectsRepository: ProjectsRepository,
    private readonly detectorSettings: DetectorSettingsService,
  ) {}

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
    const result = await searchTenant<Record<string, unknown>>(this.quickwit, "detections", { orgId, projectId }, {
      filter: quickwitTerm('kind', 'finding'),
      startTimestamp,
      endTimestamp,
      maxHits: 500,
      sortBy: ['-timestamp'],
    });

    return (result.hits ?? []).flatMap((hit) => {
      const source = quickwitSource<TraceSource | RequestSource>(hit) as Record<string, unknown> | undefined;
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
    const result = await searchTenant<Record<string, unknown>>(this.quickwit, "detections", { orgId, projectId }, {
      filter: 'kind:(run_started OR run_completed OR run_failed)',
      startTimestamp,
      endTimestamp,
      maxHits: 500,
      sortBy: ['-timestamp'],
    });

    return (result.hits ?? []).flatMap((hit) => {
      const source = quickwitSource<TraceSource | RequestSource>(hit) as Record<string, unknown> | undefined;
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
