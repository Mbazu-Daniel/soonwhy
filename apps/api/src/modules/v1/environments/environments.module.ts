import { Module } from '@nestjs/common';
import { EnvironmentsController } from './environments.controller';
import { EnvironmentsService } from './environments.service';
import { EnvironmentsRepository } from './environments.repository';

@Module({
  controllers: [EnvironmentsController],
  providers: [EnvironmentsService, EnvironmentsRepository],
  exports: [EnvironmentsService],
})
export class EnvironmentsModule {}
