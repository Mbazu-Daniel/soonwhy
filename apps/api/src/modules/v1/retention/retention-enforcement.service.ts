import { Injectable, Logger, Optional } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { RetentionPoliciesService } from "./retention-policies.service";
import { CronLeaseService } from "../../../common/cron/cron-lease.service";
import { isCleanupDue } from "./retention.schedule";
import type { CleanupPolicyResult } from "./retention.types";

@Injectable()
export class RetentionEnforcementService {
  private readonly logger = new Logger(RetentionEnforcementService.name);

  constructor(
    private readonly policies: RetentionPoliciesService,
    @Optional() private readonly lease?: CronLeaseService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_4AM)
  async enforceDuePolicies(now = new Date()): Promise<CleanupPolicyResult[]> {
    if (!this.lease) {
      return this.enforce(now);
    }

    let results: CleanupPolicyResult[] = [];
    await this.lease.runExclusive("retention-enforcement", 30 * 60 * 1000, async () => {
      results = await this.enforce(now);
    });
    return results;
  }

  private async enforce(now: Date): Promise<CleanupPolicyResult[]> {
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
