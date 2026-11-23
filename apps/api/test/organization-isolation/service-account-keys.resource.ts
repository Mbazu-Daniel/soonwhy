import { defineResource, type IsolationResource } from "@soonwhy/test-support";
import { eq } from "drizzle-orm";
import { db } from "../../src/common/db";
import { apiKeys } from "../../src/common/db/schema";
import { apiKeysRepository, serviceAccountsRepository } from "./services";
import { rowsWithId } from "./support";
import type { TestOrganization } from "./types";

type Ref = { accountId: string; keyId: string };

const resource: IsolationResource<TestOrganization, Ref> = {
  name: "service account keys",
  seed: async (victim) => {
    const account = await serviceAccountsRepository.create({ orgId: victim.organization.id, name: "ci" });
    const key = await apiKeysRepository.createApiKey({ projectId: victim.project.id, name: "ci key", scopes: [], serviceAccountId: account.id });
    return { accountId: account.id, keyId: key.id };
  },
  intact: async (ref) => (await db.select().from(apiKeys).where(eq(apiKeys.id, ref.keyId))).length === 1,
  cases: {
    list: {
      attempts: ({ actor, ref }) => ({ "list the account's keys with the actor's organization": async () => rowsWithId(await serviceAccountsRepository.keys(actor.organization.id, ref.accountId), ref.keyId) }),
      owner: async ({ owner, ref }) => rowsWithId(await serviceAccountsRepository.keys(owner.organization.id, ref.accountId), ref.keyId),
    },
  },
};

export const serviceAccountKeyResource = defineResource(resource);
