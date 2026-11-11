import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { RetentionPoliciesService } from "./retention-policies.service";
import { isCleanupDue } from "./retention.schedule";
import type { CleanupPolicyResult } from "./retention.types";

@Injectable()
export class RetentionEnforcementService {
  private readonly logger = new Logger(RetentionEnforcementService.name);

  constructor(private readonly policies: RetentionPoliciesService) {}

  @Cron(CronExpression.EVERY_DAY_AT_4AM)
  async enforceDuePolicies(now = new Date()): Promise<CleanupPolicyResult[]> {
    const policies = await this.policies.getAllActivePolicies();
    const results: CleanupPolicyResult[] = [];

    for (const policy of policies) {
      if (!isCleanupDue(policy.lastCleanupAt, policy.cleanupSchedule, now)) continue;

      const result = await this.policies.executePolicy(policy, now);
      results.push(result);
    }

    this.logger.log(`Retention enforcement processed ${results.length} policies`);
    return results;
  }
}
