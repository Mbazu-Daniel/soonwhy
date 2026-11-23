import { defineResource, type IsolationResource } from "@soonwhy/test-support";
import { eq } from "drizzle-orm";
import { db } from "../../src/common/db";
import { apiKeys } from "../../src/common/db/schema";
import { API_KEY_NAME } from "./constants";
import { apiKeysRepository, apiKeysService } from "./services";
import { rowsWithId } from "./support";
import type { TestOrganization } from "./types";

type Ref = { id: string; projectId: string };

const resource: IsolationResource<TestOrganization, Ref> = {
  name: "API keys",
  seed: async (victim) => {
    const key = await apiKeysRepository.createApiKey({ projectId: victim.project.id, name: API_KEY_NAME, scopes: [] });
    return { id: key.id, projectId: victim.project.id };
  },
  intact: async (ref) => {
    const rows = await db.select().from(apiKeys).where(eq(apiKeys.projectId, ref.projectId));
    return rows.length === 1 && rows[0]?.id === ref.id && rows[0]?.name === API_KEY_NAME;
  },
  cases: {
    list: {
      attempts: ({ actor, ref }) => ({
        "the other project with the actor's organization": async () => rowsWithId(await apiKeysService.getApiKeysForProject(ref.projectId, actor.organization.id), ref.id),
        "the actor's own project": async () => rowsWithId(await apiKeysService.getApiKeysForProject(actor.project.id, actor.organization.id), ref.id),
      }),
      owner: async ({ owner, ref }) => rowsWithId(await apiKeysService.getApiKeysForProject(ref.projectId, owner.organization.id), ref.id),
    },
    read: {
      attempts: ({ actor, ref }) => ({ "by id with the actor's organization": () => apiKeysRepository.getApiKeyById(ref.id, actor.organization.id) }),
      owner: ({ owner, ref }) => apiKeysRepository.getApiKeyById(ref.id, owner.organization.id),
    },
    create: {
      attempts: ({ actor, ref }) => ({
        "a key in the other project": () => apiKeysService.createApiKey(ref.projectId, actor.organization.id, { name: "backdoor", scopes: [] }),
      }),
      owner: ({ owner, ref }) => apiKeysService.createApiKey(ref.projectId, owner.organization.id, { name: "extra", scopes: [] }),
    },
    delete: {
      checksResult: false,
      attempts: ({ actor, ref }) => ({
        "naming the other project": () => apiKeysService.deleteApiKey(ref.id, actor.organization.id, ref.projectId, "owner"),
        "naming the actor's own project": () => apiKeysService.deleteApiKey(ref.id, actor.organization.id, actor.project.id, "owner"),
        "the repository delete with the actor's organization": () => apiKeysRepository.deleteApiKey(ref.id, actor.organization.id),
      }),
      owner: ({ owner, ref }) => apiKeysService.deleteApiKey(ref.id, owner.organization.id, ref.projectId, "owner"),
    },
  },
};

export const apiKeyResource = defineResource(resource);
