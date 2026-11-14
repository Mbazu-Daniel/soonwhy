import { Module } from "@nestjs/common";
import { BillingModule } from "../../billing/billing.module";
import { InvestigationToolsModule } from "../../investigation-tools";
import { ProjectsModule } from "../../projects";
import { AiModule } from "../ai.module";
import { ChatThreadsRepository } from "./chat-threads.repository";
import { InvestigationChatController } from "./investigation-chat.controller";
import { InvestigationChatService } from "./investigation-chat.service";

@Module({
  imports: [AiModule, BillingModule, InvestigationToolsModule, ProjectsModule],
  controllers: [InvestigationChatController],
  providers: [InvestigationChatService, ChatThreadsRepository],
})
export class InvestigationChatModule {}
