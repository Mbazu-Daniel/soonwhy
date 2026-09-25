import { Module } from '@nestjs/common';
import { ProjectsModule } from '../projects/projects.module';
import { DetectionController } from './detection.controller';
import { DetectionService } from './detection.service';
import { RcaModule } from './rca.module';
import { RcaOrchestrator } from './rca.orchestrator';
import { RcaController } from './rca.controller';
import { RcaApiService } from './rca.api';
import { RcaAnalysisRepository } from './rca.repository';
import { RcaPersistenceService } from './rca.persistence';

@Module({
  imports: [ProjectsModule, RcaModule],
  controllers: [DetectionController, RcaController],
  providers: [
    DetectionService,
    RcaOrchestrator,
    RcaApiService,
    RcaAnalysisRepository,
    RcaPersistenceService,
  ],
})
export class DetectionModule {}
