import { Module } from "@nestjs/common";
import { BusinessOperationsController } from "./presentation/business-operations.controller";
import { BusinessOperationsRepository } from "./infrastructure/business-operations.repository";
import { BusinessOperationsService } from "./application/business-operations.service";

@Module({
  controllers: [BusinessOperationsController],
  providers: [BusinessOperationsService, BusinessOperationsRepository],
  exports: [BusinessOperationsService],
})
export class BusinessOperationsModule {}
