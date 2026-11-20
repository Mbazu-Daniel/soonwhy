import { Module } from "@nestjs/common";
import { TeamsController } from "./presentation/teams.controller";
import { TeamsRepository } from "./infrastructure/teams.repository";
import { TeamsService } from "./application/teams.service";

@Module({
  controllers: [TeamsController],
  providers: [TeamsService, TeamsRepository],
  exports: [TeamsService],
})
export class TeamsModule {}
