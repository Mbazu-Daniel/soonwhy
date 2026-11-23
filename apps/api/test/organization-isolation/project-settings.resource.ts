import { defineResource, type IsolationResource } from "@soonwhy/test-support";
import { eq } from "drizzle-orm";
import { db } from "../../src/common/db";
import { projectSettings } from "../../src/common/db/schema";
import { SEEDED_ATTRIBUTE_LIMIT } from "./constants";
import { projectsRepository } from "./services";
import type { TestOrganization } from "./types";

type Ref = { projectId: string };

async function seededSettings(projectId: string, organizationId: string) {
  const settings = await projectsRepository.getProjectSettings(projectId, organizationId);
  return settings.maxAttributeCount === SEEDED_ATTRIBUTE_LIMIT ? settings : undefined;
}

const resource: IsolationResource<TestOrganization, Ref> = {
  name: "project settings",
  seed: async (victim) => {
    await projectsRepository.updateProjectSettings(victim.project.id, victim.organization.id, { maxAttributeCount: SEEDED_ATTRIBUTE_LIMIT });
    return { projectId: victim.project.id };
  },
  intact: async (ref) => {
    const [row] = await db.select().from(projectSettings).where(eq(projectSettings.projectId, ref.projectId));
    return row?.maxAttributeCount === SEEDED_ATTRIBUTE_LIMIT;
  },
  cases: {
    read: {
      attempts: ({ actor, ref }) => ({ "with the actor's organization": () => seededSettings(ref.projectId, actor.organization.id) }),
      owner: ({ owner, ref }) => seededSettings(ref.projectId, owner.organization.id),
    },
    update: {
      attempts: ({ actor, ref }) => ({
        "change limits": () => projectsRepository.updateProjectSettings(ref.projectId, actor.organization.id, { maxAttributeCount: 1, statusPagePublic: true }),
      }),
      owner: ({ owner, ref }) => projectsRepository.updateProjectSettings(ref.projectId, owner.organization.id, { maxAttributeValueLength: 10 }),
    },
  },
};

export const projectSettingsResource = defineResource(resource);
