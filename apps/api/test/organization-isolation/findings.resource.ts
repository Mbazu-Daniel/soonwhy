import { randomUUID } from "node:crypto";
import { defineResource, type IsolationResource } from "@soonwhy/test-support";
import { eq } from "drizzle-orm";
import { db } from "../../src/common/db";
import { findings } from "../../src/common/db/schema";
import { upsertFinding } from "../../src/modules/v1/detection/findings/infrastructure/finding-upsert";
import { DETECTED_AT, SEEDED_FINDING_STATUS, SEEDED_FINDING_TITLE } from "./constants";
import { findingsService } from "./services";
import { rowsWithId } from "./support";
import type { TestOrganization } from "./types";

type Ref = { id: string; projectId: string };

const PAGE = { limit: 100, offset: 0 };

const resource: IsolationResource<TestOrganization, Ref> = {
  name: "findings",
  seed: async (victim) => {
    const finding = await upsertFinding(
      {
        orgId: victim.organization.id,
        projectId: victim.project.id,
        serviceName: "api",
        type: "latency",
        severity: "warning",
        title: SEEDED_FINDING_TITLE,
        description: SEEDED_FINDING_TITLE,
        observedValue: 900,
        threshold: 500,
        unit: "ms",
        windowStart: DETECTED_AT,
        windowEnd: DETECTED_AT,
        evidence: [],
        fingerprint: `latency:api:${randomUUID()}`,
      },
      DETECTED_AT,
    );
    if (!finding) throw new Error("Could not seed a finding");
    return { id: finding.id, projectId: victim.project.id };
  },
  intact: async (ref) => {
    const [row] = await db.select().from(findings).where(eq(findings.id, ref.id));
    return row?.status === SEEDED_FINDING_STATUS && row.resolvedAt === null && row.title === SEEDED_FINDING_TITLE;
  },
  cases: {
    list: {
      attempts: ({ actor, ref }) => ({
        "the other project with the actor's organization": async () => rowsWithId(await findingsService.list(actor.organization.id, ref.projectId, PAGE), ref.id),
        "the actor's own project": async () => rowsWithId(await findingsService.list(actor.organization.id, actor.project.id, PAGE), ref.id),
        "the summary of the other project": () => findingsService.summary(actor.organization.id, ref.projectId),
      }),
      owner: async ({ owner, ref }) => rowsWithId(await findingsService.list(owner.organization.id, ref.projectId, PAGE), ref.id),
    },
    read: {
      attempts: ({ actor, ref }) => ({
        "naming the other project": () => findingsService.get(actor.organization.id, ref.projectId, ref.id),
        "naming the actor's own project": () => findingsService.get(actor.organization.id, actor.project.id, ref.id),
      }),
      owner: ({ owner, ref }) => findingsService.get(owner.organization.id, ref.projectId, ref.id),
    },
    update: {
      attempts: ({ actor, ref }) => ({
        "resolve, naming the other project": () => findingsService.setStatus(actor.organization.id, ref.projectId, ref.id, "resolved", actor.userId),
        "resolve, naming the actor's own project": () => findingsService.setStatus(actor.organization.id, actor.project.id, ref.id, "resolved", actor.userId),
      }),
      owner: ({ owner, ref }) => findingsService.setStatus(owner.organization.id, ref.projectId, ref.id, "acknowledged", owner.userId),
    },
  },
};

export const findingResource = defineResource(resource);
