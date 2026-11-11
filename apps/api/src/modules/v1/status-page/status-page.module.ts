import { Module } from "@nestjs/common";
import { StatusPageController } from "./status-page.controller";
import { StatusPageSubscriptionsController } from "./status-page-subscriptions.controller";
import { StatusPageSubscriptionsRepository } from "./status-page-subscriptions.repository";
import { SyntheticProbesModule } from "../synthetic-probes/synthetic-probes.module";

@Module({
  imports: [SyntheticProbesModule],
  controllers: [StatusPageController, StatusPageSubscriptionsController],
  providers: [StatusPageSubscriptionsRepository],
})
export class StatusPageModule {}
