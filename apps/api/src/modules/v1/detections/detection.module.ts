import { Module } from '@nestjs/common';
import { NatsService } from '@soonwhy/shared';
import { DetectionService } from './detection.service';
import { DetectionPipeline } from './detection.pipeline';
import { DetectionTelemetryService } from './detection-telemetry.service';
import { DetectionController } from './detection.controller';
import { DetectionHealthController } from './detection-health.controller';
import { DetectionJobRunner } from './detection-job.runner';
import { DetectorSettingsModule } from '../detector-settings/detector-settings.module';
import { ProjectsModule } from '../projects/projects.module';
import { IssueLifecycleModule } from '../intelligence/issue-lifecycle.module';
import { CacheModule } from '../../../common/cache/cache.module';
import { TelemetryModule } from '../../../common/telemetry/telemetry.module';

@Module({
  imports: [
    DetectorSettingsModule,
    ProjectsModule,
    IssueLifecycleModule,
    CacheModule,
    TelemetryModule,
  ],
  controllers: [DetectionController, DetectionHealthController],
  providers: [
    DetectionService,
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
