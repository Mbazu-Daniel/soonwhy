import { Module } from "@nestjs/common";
import { HostsController } from "./presentation/hosts.controller";
import { HostsService } from "./application/hosts.service";

@Module({
  controllers: [HostsController],
  providers: [HostsService],
})
export class HostsModule {}
