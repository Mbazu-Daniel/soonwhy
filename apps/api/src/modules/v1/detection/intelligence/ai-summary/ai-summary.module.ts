import { Module } from "@nestjs/common";
import { AiModule } from "../../../investigation/ai";
import { DashboardModule } from "../../../platform/dashboard";
import { AiSummaryController } from "./ai-summary.controller";
import { AiSummaryService } from "./ai-summary.service";

@Module({
  imports: [AiModule, DashboardModule],
  controllers: [AiSummaryController],
  providers: [AiSummaryService],
})
export class AiSummaryModule {}
