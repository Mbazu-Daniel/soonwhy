import { QuickwitModule } from './common/quickwit';
import { Module } from '@nestjs/common';
import { CommonModule } from './common/common.module';
import { AuthModule } from './modules/v1/auth';
import { ClickhouseModule } from './common/clickhouse';
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

@Module({
  imports: [QuickwitModule,
    CommonModule,
    AuthModule,
    ClickhouseModule,
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
  ],
})
export class AppModule {}
