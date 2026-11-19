import { Module } from "@nestjs/common";
import { StatusPageController } from "./presentation/status-page.controller";
import { StatusPageSubscriptionsController } from "./presentation/status-page-subscriptions.controller";
import { StatusPageSubscriptionsService } from "./application/status-page-subscriptions.service";
import { StatusPageSubscriptionsRepository } from "./infrastructure/status-page-subscriptions.repository";
import { SyntheticProbesModule } from "../../detection/synthetic-probes/synthetic-probes.module";

@Module({
  imports: [SyntheticProbesModule],
  controllers: [StatusPageController, StatusPageSubscriptionsController],
  providers: [StatusPageSubscriptionsRepository, StatusPageSubscriptionsService],
})
export class StatusPageModule {}
