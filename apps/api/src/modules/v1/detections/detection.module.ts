import { Module } from '@nestjs/common';
import { ProjectsModule } from '../projects/projects.module';
import { DetectionController } from './detection.controller';
import { DetectionService } from './detection.service';
import { RcaModule } from './rca.module';
import { RcaOrchestrator } from './rca.orchestrator';

@Module({
  imports: [ProjectsModule, RcaModule],
  controllers: [DetectionController],
  providers: [DetectionService, RcaOrchestrator],
})
export class DetectionModule {}
