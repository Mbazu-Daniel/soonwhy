import { Module } from "@nestjs/common";
import { SLOService } from "./slo.service";

@Module({
  providers: [SLOService],
  exports: [SLOService],
})
export class SLOModule {}
