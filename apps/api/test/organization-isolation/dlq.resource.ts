import { defineResource, type IsolationResource } from "@soonwhy/test-support";
import { eq } from "drizzle-orm";
import { db } from "../../src/common/db";
import { deadLetterQueue } from "../../src/common/db/schema";
import { PlatformAdminGuard, SuperAdminGuard } from "../../src/common/guards/platform-admin.guard";
import { PLATFORM_ROLE } from "../../src/common/guards/platform-admin.guard.constants";
import { DlqRepository } from "../../src/modules/v1/telemetry/dlq/infrastructure/dlq.repository";
import { createUser, requestFor } from "./support";
import type { TestOrganization } from "./types";

type Ref = { id: number };
type Guard = PlatformAdminGuard | SuperAdminGuard;

const repository = new DlqRepository();
const ACTOR = "organization-isolation-test";

const memberMayUse = (guard: Guard, actor: TestOrganization) => guard.canActivate(requestFor(actor.userId));

async function staffMayUse<Result extends unknown[]>(guard: Guard, role: string, load: () => Promise<Result>): Promise<Result> {
  const [allowed, rows] = await Promise.all([guard.canActivate(requestFor(await createUser("staff", role))), load()]);
  return allowed ? rows : ([] as unknown as Result);
}

const entriesOf = async (organizationId: string, id: number) => (await repository.getDlqEntries(100, 0, organizationId)).filter((entry) => entry.id === id);
const entryOf = async (organizationId: string, id: number) => repository.getDlqEntryById(id, organizationId);
const deletedBy = async (organizationId: string, id: number) => (await repository.deleteUnlessReplaying([id], organizationId)).deleted;

const resource: IsolationResource<TestOrganization, Ref> = {
  name: "dead-letter entries (platform staff; repository also scopes by organization)",
  seed: async (victim) => {
    const [entry] = await db
      .insert(deadLetterQueue)
      .values({ signal: "log", deliveryCount: 1, reason: "rejected", payload: { secret: "organization data" }, organizationId: victim.organization.id, projectId: victim.project.id })
      .returning({ id: deadLetterQueue.id });
    if (!entry) throw new Error("Could not seed a dead-letter entry");
    return { id: entry.id };
  },
  intact: async (ref) => (await db.select().from(deadLetterQueue).where(eq(deadLetterQueue.id, ref.id))).length === 1,
  cases: {
    list: {
      attempts: ({ actor, ref }) => ({
        "an organization member opens the admin list": () => memberMayUse(new PlatformAdminGuard(), actor),
        "the repository list scoped to the actor's organization": () => entriesOf(actor.organization.id, ref.id),
      }),
      owner: ({ owner, ref }) => staffMayUse(new PlatformAdminGuard(), PLATFORM_ROLE.ADMIN, () => entriesOf(owner.organization.id, ref.id)),
    },
    read: {
      attempts: ({ actor, ref }) => ({
        "an organization member opens one entry": () => memberMayUse(new PlatformAdminGuard(), actor),
        "the repository entry scoped to the actor's organization": () => entryOf(actor.organization.id, ref.id),
      }),
      owner: ({ owner, ref }) => staffMayUse(new PlatformAdminGuard(), PLATFORM_ROLE.ADMIN, async () => [await entryOf(owner.organization.id, ref.id)].filter(Boolean)),
    },
    update: {
      attempts: ({ actor, ref }) => ({
        "an organization member replays an entry": () => memberMayUse(new SuperAdminGuard(), actor),
        "the repository replay claim scoped to the actor's organization": () => repository.claimReplay(ref.id, ACTOR, false, actor.organization.id),
      }),
      owner: ({ owner, ref }) => staffMayUse(new SuperAdminGuard(), PLATFORM_ROLE.SUPER_ADMIN, async () => [await repository.claimReplay(ref.id, ACTOR, false, owner.organization.id)].filter(Boolean)),
    },
    delete: {
      attempts: ({ actor, ref }) => ({
        "an organization member deletes an entry": () => memberMayUse(new SuperAdminGuard(), actor),
        "the repository delete scoped to the actor's organization": () => deletedBy(actor.organization.id, ref.id),
      }),
      owner: ({ owner, ref }) => staffMayUse(new SuperAdminGuard(), PLATFORM_ROLE.SUPER_ADMIN, () => deletedBy(owner.organization.id, ref.id)),
    },
  },
};

export const dlqResource = defineResource(resource);
