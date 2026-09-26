import { Module } from '@nestjs/common';
import { BillingController } from './billing.controller';
import { ProjectBillingController } from './project-billing.controller';
import { BillingRepository } from './billing.repository';
import { BillingService } from './billing.service';

@Module({
  controllers: [BillingController, ProjectBillingController],
  providers: [BillingRepository, BillingService],
  exports: [BillingService],
})
export class BillingModule {}
