import { Module } from "@nestjs/common";
import { AIInvestigationService } from "./ai-investigation.service";
import { AIInvestigationController } from "./ai-investigation.controller";
import { AIInvestigationRepository } from "./ai-investigation.repository";
import { DeadLetterInvestigationRepository } from "./dead-letter.repository";

@Module({
  controllers: [AIInvestigationController],
  providers: [
    AIInvestigationService,
    AIInvestigationRepository,
    DeadLetterInvestigationRepository,
  ],
  exports: [AIInvestigationService, AIInvestigationRepository, DeadLetterInvestigationRepository],
})
export class AIInvestigationModule {}
