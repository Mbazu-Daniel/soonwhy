import { Module } from "@nestjs/common";
import { RouterModule } from "@nestjs/core";
import { APP_INTERCEPTOR } from "@nestjs/core";
import { CommonModule } from "./common/common.module";
import { AuthModule } from "./modules/v1/auth";
import { OrganizationsModule } from "./modules/v1/organizations";
import { ApiKeysModule } from "./modules/v1/api-keys";
import { ServicesModule } from "./modules/v1/services";
import { ProjectsModule } from "./modules/v1/projects";
import { HealthModule } from "./modules/v1/health";
import { DashboardModule } from "./modules/v1/dashboard";
import { LogsModule } from "./modules/v1/logs";
import { MetricsModule } from "./modules/v1/metrics";
import { RequestsModule } from "./modules/v1/requests";
import { TracesModule } from "./modules/v1/traces";
import { DetectionModule } from "./modules/v1/detections";
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
import { TelemetryModule } from "./common/telemetry";
import { MetricsInterceptor } from "./common/telemetry/metrics.interceptor";

const organizationScopedModules = [
  ApiKeysModule,
  ServicesModule,
  ProjectsModule,
  DashboardModule,
  LogsModule,
  MetricsModule,
  RequestsModule,
  TracesModule,
  DetectionModule,
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
];

@Module({
  imports: [
    CommonModule,
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
    ...organizationScopedModules,
  ],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: MetricsInterceptor,
    },
  ],
})
export class AppModule {}
