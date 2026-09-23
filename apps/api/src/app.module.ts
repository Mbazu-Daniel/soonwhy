import { QuickwitModule } from './common/quickwit';
import { Module } from '@nestjs/common';
import { CommonModule } from './common/common.module';
import { AuthModule } from './modules/v1/auth';
import { OrganizationsModule } from './modules/v1/organizations';
import { ApiKeysModule } from './modules/v1/api-keys';
import { ServicesModule } from './modules/v1/services';
import { ProjectsModule } from './modules/v1/projects';
import { HealthModule } from './modules/v1/health';
import { DashboardModule } from './modules/v1/dashboard';
import { LogsModule } from './modules/v1/logs';
import { MetricsModule } from './modules/v1/metrics';
import { RequestsModule } from './modules/v1/requests';
import { TracesModule } from './modules/v1/traces';
import { DetectionModule } from './modules/v1/detections';
import { EnvironmentsModule } from './modules/v1/environments';
import { TeamsModule } from './modules/v1/teams';
import { DeploymentsModule } from './modules/v1/deployments';
import { BusinessOperationsModule } from './modules/v1/business-operations/business-operations.module';
import { InvestigationModule } from './modules/v1/investigations/investigation.module';

@Module({
  imports: [
    QuickwitModule,
    CommonModule,
    AuthModule,
    OrganizationsModule,
    ApiKeysModule,
    ServicesModule,
    ProjectsModule,
    HealthModule,
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
  ],
})
export class AppModule {}
