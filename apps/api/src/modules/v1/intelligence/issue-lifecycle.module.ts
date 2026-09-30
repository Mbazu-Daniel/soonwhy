import { Module } from '@nestjs/common';
import { IssueLifecycleController } from './issue-lifecycle.controller';
import { IssueLifecycleQueryService } from './issue-lifecycle.query.service';
import { IssueLifecycleRepository } from './issue-lifecycle.repository';
import { IssueLifecycleService } from './issue-lifecycle.service';

@Module({
  controllers: [IssueLifecycleController],
  providers: [
    IssueLifecycleQueryService,
    IssueLifecycleRepository,
    IssueLifecycleService,
  ],
  exports: [
    IssueLifecycleQueryService,
    IssueLifecycleRepository,
    IssueLifecycleService,
  ],
})
export class IssueLifecycleModule {}
