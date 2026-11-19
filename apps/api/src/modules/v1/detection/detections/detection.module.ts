import { Module } from '@nestjs/common';
import { NatsService } from '@soonwhy/shared';
import { DetectionService } from './application/detection.service';
import { DetectionRuns } from './application/detection-runs.service';
import { DetectionPipeline } from './application/detection.pipeline';
import { DetectionTelemetryService } from './application/detection-telemetry.service';
import { DetectionController } from './presentation/detection.controller';
import { DetectionHealthController } from './presentation/detection-health.controller';
import { DetectionJobRunner } from './application/detection-job.runner';
import { DetectorSettingsModule } from '../detector-settings/detector-settings.module';
import { ProjectsModule } from '../../identity/projects/projects.module';
import { IssueLifecycleModule } from '../intelligence/issue-lifecycle.module';
import { ErrorsModule } from '../errors';
import { CacheModule } from '../../../../common/cache/cache.module';
import { TelemetryModule } from '../../../../common/telemetry/telemetry.module';

@Module({
  imports: [
    DetectorSettingsModule,
    ProjectsModule,
    IssueLifecycleModule,
    CacheModule,
    TelemetryModule,
    ErrorsModule,
  ],
  controllers: [DetectionController, DetectionHealthController],
  providers: [
    DetectionService,
    DetectionRuns,
    DetectionPipeline,
    DetectionJobRunner,
    DetectionTelemetryService,
    {
      provide: NatsService,
      useValue: new NatsService(),
    },
  ],
  exports: [DetectionService],
})
export class DetectionModule {}
