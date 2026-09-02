import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CommonModule } from './common/common.module';
import { AuthModule } from './modules/v1/auth';
import { RedisModule } from './common/redis';
import { NatsModule } from './common/nats';
import { ClickhouseModule } from './clickhouse';
import { DataArchivalModule } from './common/data-archival';
import { OrganizationsModule } from './modules/v1/organizations';
import { ApiKeysModule } from './modules/v1/api-keys';
import { ServicesModule } from './modules/v1/services';
import { ProjectsModule } from './modules/v1/projects';
import { HealthModule } from './modules/v1/health';
import { IngestionModule } from './modules/v1/ingestion';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    CommonModule,
    AuthModule,
    RedisModule,
    NatsModule,
    ClickhouseModule,
    DataArchivalModule,
    OrganizationsModule,
    ApiKeysModule,
    ServicesModule,
    ProjectsModule,
    HealthModule,
    IngestionModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
