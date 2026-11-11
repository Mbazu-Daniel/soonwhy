import { Module } from "@nestjs/common";
import { TelemetryModule } from "../../../common/telemetry";
import { RetentionPoliciesController } from "./retention-policies.controller";
import { RetentionPoliciesService } from "./retention-policies.service";
import { RetentionEnforcementService } from "./retention-enforcement.service";

@Module({
  imports: [TelemetryModule],
  controllers: [RetentionPoliciesController],
  providers: [RetentionPoliciesService, RetentionEnforcementService],
  exports: [RetentionPoliciesService],
})
export class RetentionModule {}
