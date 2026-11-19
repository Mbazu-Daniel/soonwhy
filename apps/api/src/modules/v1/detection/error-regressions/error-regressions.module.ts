import { Module } from "@nestjs/common";
import { ErrorRegressionsController } from "./presentation/error-regressions.controller";
import { ErrorRegressionsService } from "./application/error-regressions.service";

@Module({
  controllers: [ErrorRegressionsController],
  providers: [ErrorRegressionsService],
  exports: [ErrorRegressionsService],
})
export class ErrorRegressionsModule {}
