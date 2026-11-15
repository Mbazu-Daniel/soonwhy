import { Module } from "@nestjs/common";
import { IndexHealthController } from "./index-health.controller";
import { IndexHealthService } from "./index-health.service";

@Module({
  controllers: [IndexHealthController],
  providers: [IndexHealthService],
})
export class IndexHealthModule {}
