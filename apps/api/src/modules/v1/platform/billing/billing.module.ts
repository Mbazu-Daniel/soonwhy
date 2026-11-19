import { Module } from "@nestjs/common";
import { BillingController } from "./presentation/billing.controller";
import { BillingRepository } from "./infrastructure/billing.repository";
import { BillingService } from "./application/billing.service";

@Module({
  controllers: [BillingController],
  providers: [BillingRepository, BillingService],
  exports: [BillingService],
})
export class BillingModule {}
