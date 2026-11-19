import { Module } from "@nestjs/common";
import { TelemetryModule } from "../../../../common/telemetry";
import { RetentionPoliciesController } from "./presentation/retention-policies.controller";
import { RetentionPoliciesService } from "./application/retention-policies.service";
import { RetentionEnforcementService } from "./application/retention-enforcement.service";

@Module({
  imports: [TelemetryModule],
  controllers: [RetentionPoliciesController],
  providers: [RetentionPoliciesService, RetentionEnforcementService],
  exports: [RetentionPoliciesService],
})
export class RetentionModule {}
