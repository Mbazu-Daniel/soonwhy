import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth';
import { RedisModule } from './redis';
import { OrganizationsModule } from './modules/v1/organizations';
import { EnvironmentsModule } from './modules/v1/environments';
import { ApiKeysModule } from './modules/v1/api-keys';
import { ServicesModule } from './modules/v1/services';
import { ProjectsModule } from './modules/v1/projects';
import { HealthModule } from './modules/v1/health';

@Module({
  imports: [
    AuthModule,
    RedisModule,
    OrganizationsModule,
    EnvironmentsModule,
    ApiKeysModule,
    ServicesModule,
    ProjectsModule,
    HealthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
