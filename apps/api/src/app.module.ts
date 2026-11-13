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
import { THROTTLER_OPTIONS } from "./common/throttling/throttling.constants";
import { CacheModule } from "./common/cache/cache.module";
import { DrizzleIdempotencyModule } from "./common/idempotency/drizzle-idempotency.module";
import { MaintenanceModule } from "./common/maintenance/maintenance.module";
import { AuthModule } from "./modules/v1/auth";
import { OrganizationsModule } from "./modules/v1/organizations";
import { ApiKeysModule } from "./modules/v1/api-keys";
import { ServicesModule } from "./modules/v1/services";
import { ProjectsModule } from "./modules/v1/projects";
import { UploadsModule } from "./modules/v1/uploads/uploads.module";
import { HealthModule } from "./modules/v1/health";
import { DashboardModule } from "./modules/v1/dashboard";
import { LogsModule } from "./modules/v1/logs";
import { MetricsModule } from "./modules/v1/metrics";
import { RequestsModule } from "./modules/v1/requests";
import { TracesModule } from "./modules/v1/traces";
import { DetectionModule } from "./modules/v1/detections";
import { MemberContextModule } from "./modules/v1/member-context/member-context.module";
import { PlatformAdminModule } from "./modules/v1/platform-admin/platform-admin.module";
import { DetectorSettingsModule } from "./modules/v1/detector-settings";
import { EnvironmentsModule } from "./modules/v1/environments";
import { TeamsModule } from "./modules/v1/teams";
import { DeploymentsModule } from "./modules/v1/deployments";
import { BusinessOperationsModule } from "./modules/v1/business-operations/business-operations.module";
import { InvestigationModule } from "./modules/v1/investigations/investigation.module";
import { BillingModule } from "./modules/v1/billing/billing.module";
import { AiModule } from "./modules/v1/ai";
import { ClientEventsModule } from "./modules/v1/client-events";
import { IssueLifecycleModule } from "./modules/v1/intelligence/issue-lifecycle.module";
import { NotificationsModule } from "./modules/v1/notifications";
import { GithubModule } from "./modules/v1/github/github.module";
import { SyntheticProbesModule } from "./modules/v1/synthetic-probes";
import { StatusPageModule } from "./modules/v1/status-page/status-page.module";
import { CanaryModule } from "./modules/v1/canary/canary.module";
import { DlqModule } from "./modules/v1/dlq/dlq.module";
import { IngestHealthModule } from "./modules/v1/ingest-health/ingest-health.module";
import { PipelineLagModule } from "./modules/v1/pipeline-lag/pipeline-lag.module";
import { IncidentsModule } from "./modules/v1/incidents/incidents.module";
import { MaintenanceWindowsModule } from "./modules/v1/maintenance-windows/maintenance-windows.module";
import { IngestLimitsModule } from "./modules/v1/ingest-limits/ingest-limits.module";
import { SlosModule } from "./modules/v1/slos/slos.module";
import { RetentionModule } from "./modules/v1/retention/retention.module";
import { ErrorRegressionsModule } from "./modules/v1/error-regressions/error-regressions.module";
import { HistoricalAnalysisModule } from "./modules/v1/historical-analysis/historical-analysis.module";
import { AlertModule } from "./modules/v1/alert/alert.module";
import { CapacityMonitoringModule } from "./modules/v1/capacity-monitoring/capacity-monitoring.module";
import { StorageCostModule } from "./modules/v1/storage-cost/storage-cost.module";
import { SelfMonitoringModule } from "./modules/v1/self-monitoring/self-monitoring.module";
import { QueryCatalogModule } from "./modules/v1/query-catalog/query-catalog.module";
import { QueryIntelligenceModule } from "./modules/v1/intelligence/query-intelligence/query-intelligence.module";
import { RuntimeIntelligenceModule } from "./modules/v1/intelligence/runtime-intelligence/runtime-intelligence.module";
import { ErrorIntelligenceModule } from "./modules/v1/intelligence/error-intelligence/error-intelligence.module";
import { InfrastructureIntelligenceModule } from "./modules/v1/intelligence/infrastructure-intelligence/infrastructure-intelligence.module";
import { DependencyIntelligenceModule } from "./modules/v1/intelligence/dependency-intelligence/dependency-intelligence.module";
import { DeploymentIntelligenceModule } from "./modules/v1/intelligence/deployment-intelligence/deployment-intelligence.module";
import { AIIntelligenceModule } from "./modules/v1/intelligence/ai-intelligence/ai-intelligence.module";
import { TraceIntelligenceModule } from "./modules/v1/intelligence/trace-intelligence/trace-intelligence.module";
import { LogIntelligenceModule } from "./modules/v1/intelligence/log-intelligence/log-intelligence.module";
import { EvidenceGraphModule } from "./modules/v1/intelligence/evidence-graph/evidence-graph.module";
import { AIInvestigationModule } from "./modules/v1/intelligence/ai-investigation/ai-investigation.module";
import { RecommendationEngineModule } from "./modules/v1/intelligence/recommendation-engine/recommendation-engine.module";
import { VerificationEngineModule } from "./modules/v1/intelligence/verification-engine/verification-engine.module";
import { TelemetryModule } from "./common/telemetry";

const organizationScopedModules = [
  ApiKeysModule,
  ServicesModule,
  ProjectsModule,
  UploadsModule,
  DashboardModule,
  LogsModule,
  MetricsModule,
  RequestsModule,
  TracesModule,
  DetectionModule,
  DetectorSettingsModule,
  EnvironmentsModule,
  TeamsModule,
  DeploymentsModule,
  BusinessOperationsModule,
  InvestigationModule,
  BillingModule,
  AiModule,
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
  QueryIntelligenceModule,
  RuntimeIntelligenceModule,
  ErrorIntelligenceModule,
  InfrastructureIntelligenceModule,
  DependencyIntelligenceModule,
  DeploymentIntelligenceModule,
  AIIntelligenceModule,
  TraceIntelligenceModule,
  LogIntelligenceModule,
  EvidenceGraphModule,
  AIInvestigationModule,
  RecommendationEngineModule,
  VerificationEngineModule,
];

@Module({
  imports: [
    IdempotencyModule.forRoot({
      scope: (req: any) => req.headers['x-org-id'] || req.user?.id || 'global',
      // Idempotency records live in Postgres (DrizzleIdempotencyStore,
      // registered by DrizzleIdempotencyModule) — they survive restarts and
      // are shared between instances.
    }),
    ScheduleModule.forRoot(),
    DrizzleIdempotencyModule,
    CacheModule,
    CommonModule,
    ResilienceConfigModule,
    ThrottlerModule.forRoot(THROTTLER_OPTIONS),
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
    IngestHealthModule,
    PipelineLagModule,
    SelfMonitoringModule,
    PlatformAdminModule,
    IncidentsModule,
    ...organizationScopedModules,
  ],
  controllers: [RootController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ApiThrottlerGuard,
    },
  ],
})
export class AppModule {}
