import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CommonModule } from './common/common.module';
import { AuthModule } from './modules/v1/auth';
import { RedisModule } from './common/redis';
import { ClickhouseModule } from './common/clickhouse';
import { OrganizationsModule } from './modules/v1/organizations';
import { ApiKeysModule } from './modules/v1/api-keys';
import { ServicesModule } from './modules/v1/services';
import { ProjectsModule } from './modules/v1/projects';
import { HealthModule } from './modules/v1/health';
import { DashboardModule } from './modules/v1/dashboard';

@Module({
  imports: [
    CommonModule,
    AuthModule,
    RedisModule,
    ClickhouseModule,
    OrganizationsModule,
    ApiKeysModule,
    ServicesModule,
    ProjectsModule,
    HealthModule,
    DashboardModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
