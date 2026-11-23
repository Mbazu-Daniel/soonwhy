import { closeDatabase, databaseTestsEnabled, describeOrganizationIsolation } from "@soonwhy/test-support";
import { describe, expect, it } from "vitest";
import { claimAs, eventIdFor, receiptRow, resetReceipts } from "./receipt-context";
import { receiptResource } from "./receipts.resource";
import type { IngestOrganization } from "./types";

describeOrganizationIsolation<IngestOrganization>({
  name: "ingest receipts",
  enabled: databaseTestsEnabled,
  reset: resetReceipts,
  close: closeDatabase,
  createOrganization: async (label) => ({ organizationId: `org_${label}`, projectId: `proj_${label}` }),
  resources: [receiptResource],
});

describe.skipIf(!databaseTestsEnabled)("event ids never collide across organizations", () => {
  it("gives the same payload from two organizations different ids, and from two projects of one organization", () => {
    const ids = new Set([
      eventIdFor({ organizationId: "org_a", projectId: "proj_1" }),
      eventIdFor({ organizationId: "org_b", projectId: "proj_1" }),
      eventIdFor({ organizationId: "org_a", projectId: "proj_2" }),
    ]);

    expect(ids.size).toBe(3);
  });

  it("lets two organizations each store the same event, neither being treated as a duplicate of the other", async () => {
    await resetReceipts();
    const a = { organizationId: "org_a", projectId: "proj_1" };
    const b = { organizationId: "org_b", projectId: "proj_1" };

    const first = await claimAs(a, eventIdFor(a));
    const second = await claimAs(b, eventIdFor(b));

    expect([...first.claimed]).toEqual([eventIdFor(a)]);
    expect([...second.claimed]).toEqual([eventIdFor(b)]);
    expect(await receiptRow(eventIdFor(a))).toMatchObject({ organizationId: "org_a" });
    expect(await receiptRow(eventIdFor(b))).toMatchObject({ organizationId: "org_b" });
  });
});
