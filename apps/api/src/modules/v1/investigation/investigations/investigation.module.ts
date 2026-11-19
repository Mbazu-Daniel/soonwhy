import { Module } from "@nestjs/common";
import { InvestigationController } from "./presentation/investigation.controller";
import { InvestigationRepository } from "./infrastructure/investigation.repository";
import { InvestigationService } from "./application/investigation.service";

@Module({
  controllers: [InvestigationController],
  providers: [InvestigationService, InvestigationRepository],
  exports: [InvestigationService],
})
export class InvestigationModule {}
