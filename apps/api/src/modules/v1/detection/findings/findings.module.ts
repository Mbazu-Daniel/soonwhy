import { Module } from "@nestjs/common";
import { FindingsService } from "./application/findings.service";
import { FindingRepository } from "./infrastructure/finding.repository";
import { FindingsController } from "./presentation/findings.controller";

@Module({
  controllers: [FindingsController],
  providers: [FindingsService, FindingRepository],
  exports: [FindingsService],
})
export class FindingsModule {}
