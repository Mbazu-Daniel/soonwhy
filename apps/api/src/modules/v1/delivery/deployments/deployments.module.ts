import { Module } from "@nestjs/common";
import { DeploymentsController } from "./presentation/deployments.controller";
import { DeploymentsRepository } from "./infrastructure/deployments.repository";
import { DeploymentsService } from "./application/deployments.service";

@Module({
  controllers: [DeploymentsController],
  providers: [DeploymentsService, DeploymentsRepository],
  exports: [DeploymentsService, DeploymentsRepository],
})
export class DeploymentsModule {}
