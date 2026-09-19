import { Module } from '@nestjs/common';
import { ProjectsModule } from '../projects/projects.module';
import { DetectionController } from './detection.controller';
import { DetectionService } from './detection.service';

@Module({
  imports: [ProjectsModule],
  controllers: [DetectionController],
  providers: [DetectionService],
})
export class DetectionModule {}
