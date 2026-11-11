import { Module } from "@nestjs/common";
import { ErrorRegressionsController } from "./error-regressions.controller";
import { ErrorRegressionsService } from "./error-regressions.service";

@Module({
  controllers: [ErrorRegressionsController],
  providers: [ErrorRegressionsService],
  exports: [ErrorRegressionsService],
})
export class ErrorRegressionsModule {}
