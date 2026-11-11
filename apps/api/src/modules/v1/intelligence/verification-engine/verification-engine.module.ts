import { Module } from "@nestjs/common";
import { VerificationEngineService } from "./verification-engine.service";
import { VerificationEngineController } from "./verification-engine.controller";

@Module({
  controllers: [VerificationEngineController],
  providers: [VerificationEngineService],
  exports: [VerificationEngineService],
})
export class VerificationEngineModule {}
