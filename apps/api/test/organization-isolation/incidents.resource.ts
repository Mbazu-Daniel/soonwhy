import { randomUUID } from "node:crypto";
import { defineResource, type IsolationResource } from "@soonwhy/test-support";
import { eq } from "drizzle-orm";
import { db } from "../../src/common/db";
import { incidents } from "../../src/common/db/schema";
import { incidentsRepository } from "./services";
import { rowsWithId } from "./support";
import type { TestOrganization } from "./types";

type Ref = { id: number; incidentId: string; projectId: string; alertRuleId: string; lastEvaluatedAt: Date };

const scopeAsActor = (actor: TestOrganization, ref: Ref) => [
  { orgId: actor.organization.id, projectId: ref.projectId },
  { orgId: actor.organization.id, projectId: actor.project.id },
];

const resource: IsolationResource<TestOrganization, Ref> = {
  name: "incidents",
  seed: async (victim) => {
    const incident = await incidentsRepository.createIncident({
      incidentId: `incident-${randomUUID()}`,
      orgId: victim.organization.id,
      projectId: victim.project.id,
      alertRuleId: `rule-${randomUUID()}`,
      severity: "critical",
      title: "Down",
      body: "Down",
    });
    if (!incident) throw new Error("Could not seed an incident");
    return { id: incident.id, incidentId: incident.incidentId, projectId: victim.project.id, alertRuleId: incident.alertRuleId, lastEvaluatedAt: incident.lastEvaluatedAt as Date };
  },
  intact: async (ref) => {
    const [row] = await db.select().from(incidents).where(eq(incidents.id, ref.id));
    return row?.status === "firing" && row.recoveryNotified === false && row.lastEvaluatedAt?.getTime() === ref.lastEvaluatedAt.getTime();
  },
  cases: {
    list: {
      attempts: ({ actor, ref }) => ({
        "the other project with the actor's organization": async () => rowsWithId(await incidentsRepository.getIncidents(actor.organization.id, ref.projectId), ref.id),
        "active incidents of the rule, scoped to the actor": async () => (await Promise.all(scopeAsActor(actor, ref).map((scope) => incidentsRepository.getActiveIncidentsForRule(scope, ref.alertRuleId)))).flat(),
      }),
      owner: async ({ owner, ref }) => rowsWithId(await incidentsRepository.getIncidents(owner.organization.id, ref.projectId), ref.id),
    },
    read: {
      attempts: ({ actor, ref }) => ({
        "by incident id, scoped to the actor": async () => (await Promise.all(scopeAsActor(actor, ref).map((scope) => incidentsRepository.getIncidentByIncidentId(scope, ref.incidentId)))).filter(Boolean),
      }),
      owner: ({ owner, ref }) => incidentsRepository.getIncidentByIncidentId({ orgId: owner.organization.id, projectId: ref.projectId }, ref.incidentId),
    },
    update: {
      attempts: ({ actor, ref }) => ({
        acknowledge: async () => (await Promise.all(scopeAsActor(actor, ref).map((scope) => incidentsRepository.acknowledgeIncident(scope, ref.id, "attacker")))).filter(Boolean),
        resolve: async () => (await Promise.all(scopeAsActor(actor, ref).map((scope) => incidentsRepository.resolveIncident(scope, ref.id)))).filter(Boolean),
        "claim the recovery notice": async () => (await Promise.all(scopeAsActor(actor, ref).map((scope) => incidentsRepository.markRecoveryNotified(scope, ref.id)))).filter(Boolean),
        "touch the last evaluated time": async () => {
          await Promise.all(scopeAsActor(actor, ref).map((scope) => incidentsRepository.updateIncidentLastEvaluated(scope, ref.id)));
        },
      }),
      owner: ({ owner, ref }) => incidentsRepository.acknowledgeIncident({ orgId: owner.organization.id, projectId: ref.projectId }, ref.id, "owner"),
    },
  },
};

export const incidentResource = defineResource(resource);
