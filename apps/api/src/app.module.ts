import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CommonModule } from './common/common.module';
import { AuthModule } from './auth';
import { RedisModule } from './redis';
import { NatsModule } from './nats';
import { ClickhouseModule } from './clickhouse';
import { OrganizationsModule } from './modules/v1/organizations';
import { EnvironmentsModule } from './modules/v1/environments';
import { ApiKeysModule } from './modules/v1/api-keys';
import { ServicesModule } from './modules/v1/services';
import { ProjectsModule } from './modules/v1/projects';
import { HealthModule } from './modules/v1/health';
import { IngestionModule } from './modules/v1/ingestion';
import { ColdStorageModule } from './modules/v1/cold-storage';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    CommonModule,
    AuthModule,
    RedisModule,
    NatsModule,
    ClickhouseModule,
    OrganizationsModule,
    EnvironmentsModule,
    ApiKeysModule,
    ServicesModule,
    ProjectsModule,
    HealthModule,
    IngestionModule,
    ColdStorageModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
