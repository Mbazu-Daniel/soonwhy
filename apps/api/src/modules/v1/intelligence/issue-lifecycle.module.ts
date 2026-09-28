import { Module } from '@nestjs/common';
import { IssueLifecycleController } from './issue-lifecycle.controller';
import { IssueLifecycleQueryService } from './issue-lifecycle.query.service';
import { IssueLifecycleRepository } from './issue-lifecycle.repository';

@Module({
  controllers: [IssueLifecycleController],
  providers: [IssueLifecycleQueryService, IssueLifecycleRepository],
  exports: [IssueLifecycleQueryService, IssueLifecycleRepository],
})
export class IssueLifecycleModule {}
