import { Module } from '@nestjs/common';
import { InvestigationController } from './investigation.controller';
import { InvestigationRepository } from './investigation.repository';
import { InvestigationService } from './investigation.service';

@Module({
  controllers: [InvestigationController],
  providers: [InvestigationService, InvestigationRepository],
  exports: [InvestigationService],
})
export class InvestigationModule {}
