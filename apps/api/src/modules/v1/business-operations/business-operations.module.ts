import { Module } from '@nestjs/common';
import { BusinessOperationsController } from './business-operations.controller';
import { BusinessOperationsRepository } from './business-operations.repository';
import { BusinessOperationsService } from './business-operations.service';

@Module({
  controllers: [BusinessOperationsController],
  providers: [BusinessOperationsService, BusinessOperationsRepository],
  exports: [BusinessOperationsService],
})
export class BusinessOperationsModule {}
