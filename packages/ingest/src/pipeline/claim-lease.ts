import { Injectable } from "@nestjs/common";
import { CLAIM_LEASE_MS, leaseMsForCommitTimeout } from "./constants";

@Injectable()
export class ClaimLease {
  private leaseMs = CLAIM_LEASE_MS;

  get ms(): number {
    return this.leaseMs;
  }

  configure(commitTimeoutsSecs: readonly number[]): number {
    if (commitTimeoutsSecs.length > 0) this.leaseMs = leaseMsForCommitTimeout(Math.max(...commitTimeoutsSecs));
    return this.leaseMs;
  }
}
