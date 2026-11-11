import { Module } from "@nestjs/common";
import { RecommendationEngineService } from "./recommendation-engine.service";
import { RecommendationEngineController } from "./recommendation-engine.controller";

@Module({
  controllers: [RecommendationEngineController],
  providers: [RecommendationEngineService],
  exports: [RecommendationEngineService],
})
export class RecommendationEngineModule {}
