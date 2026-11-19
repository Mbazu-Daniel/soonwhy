import { Module } from "@nestjs/common";
import { IssueLifecycleController } from "./presentation/issue-lifecycle.controller";
import { IssueLifecycleRepository } from "./infrastructure/issue-lifecycle.repository";
import { IssueLifecycleService } from "./application/issue-lifecycle.service";

@Module({
  controllers: [IssueLifecycleController],
  providers: [IssueLifecycleRepository, IssueLifecycleService],
  exports: [IssueLifecycleRepository, IssueLifecycleService],
})
export class IssueLifecycleModule {}
