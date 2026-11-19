import { Module } from "@nestjs/common";
import { NotificationsModule } from "../../notifications/notifications.module";
import { IncidentsController } from "./presentation/incidents.controller";
import { IncidentsService } from "./application/incidents.service";
import { IncidentsRepository } from "./infrastructure/incidents.repository";

@Module({
  imports: [NotificationsModule],
  controllers: [IncidentsController],
  providers: [IncidentsService, IncidentsRepository],
  exports: [IncidentsService],
})
export class IncidentsModule {}
