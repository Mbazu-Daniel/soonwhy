import { Module } from "@nestjs/common";
import { EnvironmentsController } from "./presentation/environments.controller";
import { EnvironmentsRepository } from "./infrastructure/environments.repository";
import { EnvironmentsService } from "./application/environments.service";

@Module({
  controllers: [EnvironmentsController],
  providers: [EnvironmentsService, EnvironmentsRepository],
  exports: [EnvironmentsService],
})
export class EnvironmentsModule {}
