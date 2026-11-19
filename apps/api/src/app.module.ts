import { Module } from "@nestjs/common";
import { RouterModule } from "@nestjs/core";
import { ScheduleModule } from "@nestjs/schedule";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerModule } from "@nestjs/throttler";
import { IdempotencyModule } from "@nestjs/idempotency";
import { CommonModule } from "./common/common.module";
import { RootController } from "./common/root/root.controller";
import { ResilienceConfigModule } from "./common/resilience/resilience.module";
import { ApiThrottlerGuard } from "./common/throttling/api-throttler.guard";
import { THROTTLER_ASYNC_OPTIONS } from "./common/throttling/throttling.module-options";
import { CronLeaseModule } from "./common/cron/cron-lease.module";
import { CacheModule } from "./common/cache/cache.module";
import { DrizzleIdempotencyModule } from "./common/idempotency/drizzle-idempotency.module";
import { MaintenanceModule } from "./common/maintenance/maintenance.module";
import { PublicIdBackfillService } from "./common/db/backfill-public-ids";
import { AuthModule } from "./modules/v1/identity/auth";
import { OrganizationsModule } from "./modules/v1/identity/organizations";
import { ApiKeysModule } from "./modules/v1/identity/api-keys";
import { HostsModule } from "./modules/v1/telemetry/hosts";
import { ServicesModule } from "./modules/v1/delivery/services";
import { ProjectsModule } from "./modules/v1/identity/projects";
import { UploadsModule } from "./modules/v1/platform/uploads/uploads.module";
import { HealthModule } from "./modules/v1/platform/health";
import { DashboardModule } from "./modules/v1/platform/dashboard";
import { LogsModule } from "./modules/v1/telemetry/logs";
import { MetricsModule } from "./modules/v1/telemetry/metrics";
import { RequestsModule } from "./modules/v1/telemetry/requests";
import { TracesModule } from "./modules/v1/telemetry/traces";
import { DetectionModule } from "./modules/v1/detection/detections";
import { AutoAnalysisModule } from "./modules/v1/investigation/auto-analysis";
import { ErrorsModule } from "./modules/v1/detection/errors";
import { MemberContextModule } from "./modules/v1/identity/member-context/member-context.module";
import { PlatformAdminModule } from "./modules/v1/identity/platform-admin/platform-admin.module";
import { DetectorSettingsModule } from "./modules/v1/detection/detector-settings";
import { EnvironmentsModule } from "./modules/v1/delivery/environments";
import { TeamsModule } from "./modules/v1/identity/teams";
import { DeploymentsModule } from "./modules/v1/delivery/deployments";
import { BusinessOperationsModule } from "./modules/v1/platform/business-operations/business-operations.module";
import { InvestigationModule } from "./modules/v1/investigation/investigations/investigation.module";
import { BillingModule } from "./modules/v1/platform/billing/billing.module";
import { AiModule } from "./modules/v1/investigation/ai";
import { ClientEventsModule } from "./modules/v1/telemetry/client-events";
import { IssueLifecycleModule } from "./modules/v1/detection/intelligence/issue-lifecycle.module";
import { NotificationsModule } from "./modules/v1/notifications";
import { GithubModule } from "./modules/v1/delivery/github/github.module";
import { GithubSetupModule } from "./modules/v1/delivery/github/github-setup.module";
import { SyntheticProbesModule } from "./modules/v1/detection/synthetic-probes";
import { StatusPageModule } from "./modules/v1/delivery/status-page/status-page.module";
import { CanaryModule } from "./modules/v1/detection/canary/canary.module";
import { DlqModule } from "./modules/v1/telemetry/dlq/dlq.module";
import { IngestHealthModule } from "./modules/v1/telemetry/ingest-health/ingest-health.module";
import { IndexHealthModule } from "./modules/v1/telemetry/index-health";
import { PipelineLagModule } from "./modules/v1/telemetry/pipeline-lag/pipeline-lag.module";
import { IncidentsModule } from "./modules/v1/detection/incidents/incidents.module";
import { MaintenanceWindowsModule } from "./modules/v1/detection/maintenance-windows/maintenance-windows.module";
import { IngestLimitsModule } from "./modules/v1/telemetry/ingest-limits/ingest-limits.module";
import { SlosModule } from "./modules/v1/detection/slos/slos.module";
import { SearchAuditModule } from "./modules/v1/platform/search-audit";
import { ServiceAccountsModule } from "./modules/v1/identity/service-accounts";
import { RetentionModule } from "./modules/v1/telemetry/retention/retention.module";
import { ErrorRegressionsModule } from "./modules/v1/detection/error-regressions/error-regressions.module";
import { HistoricalAnalysisModule } from "./modules/v1/investigation/historical-analysis/historical-analysis.module";
import { AlertModule } from "./modules/v1/detection/alert/alert.module";
import { CapacityMonitoringModule } from "./modules/v1/telemetry/capacity-monitoring/capacity-monitoring.module";
import { StorageCostModule } from "./modules/v1/telemetry/storage-cost/storage-cost.module";
import { QueryCatalogModule } from "./modules/v1/platform/query-catalog/query-catalog.module";
import { AiSummaryModule } from "./modules/v1/detection/intelligence/ai-summary/ai-summary.module";
import { EvidenceGraphModule } from "./modules/v1/detection/intelligence/evidence-graph/evidence-graph.module";
import { AIInvestigationModule } from "./modules/v1/detection/intelligence/ai-investigation/ai-investigation.module";
import { SoonwhyMcpModule } from "./modules/v1/investigation/mcp";
import { RcaModule } from "./modules/v1/detection/detections/rca.module";
import { InvestigationChatModule } from "./modules/v1/investigation/ai/investigation-chat";
import { TelemetryModule } from "./common/telemetry";

import { selfObservabilityEnabled } from "./common/telemetry/self-observability";

const organizationScopedModules = [
  ApiKeysModule,
  HostsModule,
  ServicesModule,
  GithubSetupModule,
  ProjectsModule,
  UploadsModule,
  DashboardModule,
  LogsModule,
  MetricsModule,
  RequestsModule,
  TracesModule,
  DetectionModule,
  AutoAnalysisModule,
  ErrorsModule,
  RcaModule,
  DetectorSettingsModule,
  EnvironmentsModule,
  TeamsModule,
  DeploymentsModule,
  BusinessOperationsModule,
  InvestigationModule,
  BillingModule,
  AiModule,
  InvestigationChatModule,
  IssueLifecycleModule,
  NotificationsModule,
  SyntheticProbesModule,
  CanaryModule,
  MaintenanceWindowsModule,
  IngestLimitsModule,
  SlosModule,
  RetentionModule,
  MemberContextModule,
  ErrorRegressionsModule,
  HistoricalAnalysisModule,
  AlertModule,
  CapacityMonitoringModule,
  StorageCostModule,
  QueryCatalogModule,
  EvidenceGraphModule,
  AIInvestigationModule,
  AiSummaryModule,
];

@Module({
  imports: [
    IdempotencyModule.forRoot({
      scope: (req: { headers: Record<string, string | undefined>; user?: { id?: string } }) =>
        req.headers['x-org-id'] || req.user?.id || 'global',
    }),
    ScheduleModule.forRoot(),
    DrizzleIdempotencyModule,
    CacheModule,
    CommonModule,
    ResilienceConfigModule,
    ThrottlerModule.forRootAsync(THROTTLER_ASYNC_OPTIONS),
    CronLeaseModule,
    MaintenanceModule,
    TelemetryModule,
    RouterModule.register([
      {
        path: "organization/:organizationId",
        children: organizationScopedModules,
      },
    ]),
    AuthModule,
    OrganizationsModule,
    HealthModule,
    GithubModule,
    ClientEventsModule,
    StatusPageModule,
    DlqModule,
    IndexHealthModule,
    SearchAuditModule,
    ServiceAccountsModule,
    ...(selfObservabilityEnabled()
      ? [IngestHealthModule, PipelineLagModule]
      : []),
    PlatformAdminModule,
    SoonwhyMcpModule,
    IncidentsModule,
    ...organizationScopedModules,
  ],
  controllers: [RootController],
  providers: [
    PublicIdBackfillService,
    {
      provide: APP_GUARD,
      useClass: ApiThrottlerGuard,
    },
  ],
})
export class AppModule {}
