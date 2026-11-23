import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { runAttempt } from "./organization-isolation.attempt";
import { ISOLATION_OPERATIONS } from "./organization-isolation.constants";
import type { OrganizationIsolationSuite } from "./organization-isolation.types";

export function describeOrganizationIsolation<Org>(suite: OrganizationIsolationSuite<Org>): void {
  describe.skipIf(!suite.enabled)(`organization isolation: ${suite.name}`, () => {
    let actor: Org;
    let victim: Org;

    beforeEach(async () => {
      await suite.reset();
      actor = await suite.createOrganization("actor");
      victim = await suite.createOrganization("victim");
    });
    afterAll(suite.close);

    for (const resource of suite.resources) {
      describe(resource.name, () => {
        for (const operation of ISOLATION_OPERATIONS) {
          const isolationCase = resource.cases[operation];
          if (!isolationCase) continue;
          const checksResult = isolationCase.checksResult !== false;

          it(`another organization cannot ${operation} it`, async () => {
            const ref = await resource.seed(victim);
            for (const [label, run] of Object.entries(isolationCase.attempts({ actor, victim, ref }))) {
              const result = await runAttempt(run);
              if (checksResult) expect(result.denied, `${operation} "${label}" ${result.detail}`).toBe(true);
              expect(await resource.intact(ref), `${operation} "${label}" changed the other organization's data`).toBe(true);
            }
          });

          it(`the owner can ${operation} it, so the refusal above is meaningful`, async () => {
            const ref = await resource.seed(victim);
            const result = await runAttempt(() => isolationCase.owner({ owner: victim, ref }));
            if (checksResult) expect(result.denied, `owner ${operation} ${result.detail}`).toBe(false);
            else expect(await resource.intact(ref), `owner ${operation} had no effect`).toBe(false);
          });
        }
      });
    }

    it("covers every resource with at least one operation", () => {
      for (const resource of suite.resources) {
        expect(Object.keys(resource.cases).length, `${resource.name} has no cases`).toBeGreaterThan(0);
      }
    });
  });
}
