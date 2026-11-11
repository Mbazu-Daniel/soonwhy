import { Module } from "@nestjs/common";
import { NotificationsModule } from "../notifications/notifications.module";
import { IncidentsController } from "./incidents.controller";
import { IncidentsService } from "./incidents.service";
import { IncidentsRepository } from "./incidents.repository";

@Module({
  imports: [NotificationsModule],
  controllers: [IncidentsController],
  providers: [IncidentsService, IncidentsRepository],
  exports: [IncidentsService],
})
export class IncidentsModule {}
