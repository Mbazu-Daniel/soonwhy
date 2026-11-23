import { describe, expect, it } from "vitest";
import { ClaimLease } from "./claim-lease";
import { CLAIM_LEASE_MS, LEASE_COMMIT_TIMEOUT_MULTIPLIER, LEASE_MARGIN_MS, leaseMsForCommitTimeout } from "./constants";

describe("receipt lease", () => {
  it("is twice the commit timeout plus a margin", () => {
    expect(leaseMsForCommitTimeout(60)).toBe(60_000 * LEASE_COMMIT_TIMEOUT_MULTIPLIER + LEASE_MARGIN_MS);
  });

  it("starts at the value for Quickwit's default commit timeout", () => {
    expect(new ClaimLease().ms).toBe(CLAIM_LEASE_MS);
    expect(CLAIM_LEASE_MS).toBe(leaseMsForCommitTimeout(60));
  });

  it("follows the longest commit timeout among the indexes", () => {
    const lease = new ClaimLease();

    expect(lease.configure([30, 120, 60])).toBe(leaseMsForCommitTimeout(120));
    expect(lease.ms).toBe(leaseMsForCommitTimeout(120));
  });

  it("keeps the current lease when no timeouts are known", () => {
    const lease = new ClaimLease();

    lease.configure([]);

    expect(lease.ms).toBe(CLAIM_LEASE_MS);
  });
});
