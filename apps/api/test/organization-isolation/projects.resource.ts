import { defineResource, type IsolationResource } from "@soonwhy/test-support";
import { eq } from "drizzle-orm";
import { db } from "../../src/common/db";
import { projects } from "../../src/common/db/schema";
import { projectsRepository } from "./services";
import { rowsWithId } from "./support";
import type { TestOrganization } from "./types";

type Ref = { id: string; name: string };

const resource: IsolationResource<TestOrganization, Ref> = {
  name: "projects",
  seed: async ({ project }) => ({ id: project.id, name: project.name }),
  intact: async (ref) => {
    const [row] = await db.select().from(projects).where(eq(projects.id, ref.id));
    return row?.name === ref.name;
  },
  cases: {
    list: {
      attempts: ({ actor, ref }) => ({ "list the actor's projects": async () => rowsWithId(await projectsRepository.getProjectsByOrgId(actor.organization.id), ref.id) }),
      owner: async ({ owner, ref }) => rowsWithId(await projectsRepository.getProjectsByOrgId(owner.organization.id), ref.id),
    },
    read: {
      attempts: ({ actor, ref }) => ({ "by id with the actor's organization": () => projectsRepository.getProjectById(ref.id, actor.organization.id) }),
      owner: ({ owner, ref }) => projectsRepository.getProjectById(ref.id, owner.organization.id),
    },
    update: {
      attempts: ({ actor, ref }) => ({ rename: () => projectsRepository.updateProject(ref.id, actor.organization.id, { name: "taken over" }) }),
      owner: ({ owner, ref }) => projectsRepository.updateProject(ref.id, owner.organization.id, { description: "mine" }),
    },
    delete: {
      checksResult: false,
      attempts: ({ actor, ref }) => ({ remove: () => projectsRepository.deleteProject(ref.id, actor.organization.id) }),
      owner: ({ owner, ref }) => projectsRepository.deleteProject(ref.id, owner.organization.id),
    },
  },
};

export const projectResource = defineResource(resource);
