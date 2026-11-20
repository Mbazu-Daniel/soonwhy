import { ForbiddenException, Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { DetectorSettingsService } from '../../detector-settings/application/detector-settings.service';
import { ProjectsRepository } from '../../../identity/projects/infrastructure/projects.repository';
import { recordDetectionRun } from '../../../../../common/telemetry/otel-metrics';
import { ErrorsService } from '../../errors';
import { DetectionPipeline } from './detection.pipeline';
import { DetectionTelemetryService } from './detection-telemetry.service';
import {
  claimQueuedDetectionRun,
  completeDetectionRun,
  enqueueDetectionRun,
  failDetectionRun,
  startDetectionRun,
} from './detection.run';
import { WINDOW_MS } from "../domain/detection.stage.constants";
import type { DetectionFinding } from '../domain/detection.types';

type Settings = Awaited<ReturnType<DetectorSettingsService['get']>>;

interface RunWindow {
  id: string;
  orgId: string;
  projectId: string;
  windowStart: Date;
  windowEnd: Date;
}

const DISABLED = 'Detections are disabled for this organisation';
const ASYNC_DISABLED = 'Async detection runs are disabled for this organisation';

@Injectable()
export class DetectionRuns {
  constructor(
    private readonly pipeline: DetectionPipeline,
    private readonly projects: ProjectsRepository,
    private readonly detectorSettings: DetectorSettingsService,
    private readonly detectionTelemetry: DetectionTelemetryService,
    @Optional() private readonly errors?: ErrorsService,
  ) {}

  private readonly logger = new Logger(DetectionRuns.name);

  async run(orgId: string, projectId: string): Promise<DetectionFinding[]> {
    const settings = await this.authorize(orgId, projectId, { async: false });
    const { start, end } = this.window();
    const run = await startDetectionRun(orgId, projectId, start, end);
    return this.process({ id: run.id, orgId, projectId, windowStart: start, windowEnd: end }, settings);
  }

  async enqueue(
    orgId: string,
    projectId: string,
  ): Promise<{ id: string; status: 'queued'; windowStart: Date; windowEnd: Date }> {
    await this.authorize(orgId, projectId, { async: true });
    const { start, end } = this.window();
    const run = await enqueueDetectionRun(orgId, projectId, start, end);
    return { id: run.id, status: 'queued', windowStart: start, windowEnd: end };
  }

  async runNext(): Promise<string | undefined> {
    const claimed = await claimQueuedDetectionRun();
    if (!claimed) return undefined;

    let settings: Settings;
    try {
      settings = await this.authorize(claimed.orgId, claimed.projectId, { async: false });
    } catch (error) {
      await failDetectionRun(claimed.id, error instanceof Error ? error.message : String(error));
      throw error;
    }
    await this.process(claimed, settings);
    return claimed.id;
  }

  private window(): { start: Date; end: Date } {
    const end = new Date();
    return { start: new Date(end.getTime() - WINDOW_MS), end };
  }

  private async authorize(orgId: string, projectId: string, options: { async: boolean }): Promise<Settings> {
    const settings = await this.detectorSettings.get(orgId);
    if (!this.detectorSettings.featureEnabled(settings, 'detections.enabled')) {
      throw new ForbiddenException(DISABLED);
    }
    if (options.async && !this.detectorSettings.featureEnabled(settings, 'detections.async')) {
      throw new ForbiddenException(ASYNC_DISABLED);
    }
    const project = await this.projects.getProjectById(projectId, orgId);
    if (!project) throw new NotFoundException('Project not found');
    return settings;
  }

  private async syncErrorFindings(orgId: string, projectId: string): Promise<void> {
    try {
      await this.errors?.syncFindings(orgId, projectId);
    } catch (error) {
      this.logger.warn(`Error findings sync failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async process(run: RunWindow, settings: Settings): Promise<DetectionFinding[]> {
    const startedAt = Date.now();
    const context = {
      orgId: run.orgId,
      projectId: run.projectId,
      runId: run.id,
      windowStart: run.windowStart,
      windowEnd: run.windowEnd,
    };
    await this.detectionTelemetry.runStarted(context);

    try {
      const findings = await this.pipeline.execute(run.orgId, run.projectId, run.windowStart, run.windowEnd, settings);
      await this.syncErrorFindings(run.orgId, run.projectId);
      await completeDetectionRun(run.id, findings.length);
      recordDetectionRun('success', Date.now() - startedAt);
      await this.detectionTelemetry.runCompleted({
        ...context,
        findingsCount: findings.length,
        durationMs: Date.now() - startedAt,
      });
      return findings;
    } catch (error) {
      await failDetectionRun(run.id, error instanceof Error ? error.message : 'Detection failed');
      recordDetectionRun('failure', Date.now() - startedAt);
      await this.detectionTelemetry.runFailed({ ...context, error, durationMs: Date.now() - startedAt });
      throw error;
    } finally {
      await this.detectionTelemetry.flush();
    }
  }
}
