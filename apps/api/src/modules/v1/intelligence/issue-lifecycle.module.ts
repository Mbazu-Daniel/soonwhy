import { Module } from "@nestjs/common";
import { IssueLifecycleController } from "./issue-lifecycle.controller";
import { IssueLifecycleRepository } from "./issue-lifecycle.repository";
import { IssueLifecycleService } from "./issue-lifecycle.service";

@Module({
  controllers: [IssueLifecycleController],
  providers: [IssueLifecycleRepository, IssueLifecycleService],
  exports: [IssueLifecycleRepository, IssueLifecycleService],
})
export class IssueLifecycleModule {}
