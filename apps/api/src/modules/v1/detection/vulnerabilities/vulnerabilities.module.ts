import { Module } from "@nestjs/common";
import { CronLeaseModule } from "../../../../common/cron/cron-lease.module";
import { VulnerabilityScanCron } from "./application/vulnerability-scan.cron";
import { VulnerabilityScanService } from "./application/vulnerability-scan.service";
import { DependencySnapshotRepository } from "./infrastructure/dependency-snapshot.repository";
import { OsvClient } from "./infrastructure/osv.client";
import { DependenciesController } from "./presentation/dependencies.controller";

@Module({
  imports: [CronLeaseModule],
  controllers: [DependenciesController],
  providers: [VulnerabilityScanService, VulnerabilityScanCron, DependencySnapshotRepository, OsvClient],
})
export class VulnerabilitiesModule {}
