import { randomUUID } from "node:crypto";
import { defineResource, type IsolationResource } from "@soonwhy/test-support";
import { eq } from "drizzle-orm";
import { db } from "../../src/common/db";
import { services } from "../../src/common/db/schema";
import { servicesRepository } from "./services";
import type { TestOrganization } from "./types";

type Ref = { id: string; publicId: string; projectId: string };

const SEEDED_LANGUAGE = "Node.js";

const resource: IsolationResource<TestOrganization, Ref> = {
  name: "services",
  seed: async (victim) => {
    const service = await servicesRepository.createService({
      projectId: victim.project.id,
      orgId: victim.organization.id,
      name: "checkout",
      slug: `checkout-${randomUUID()}`,
      language: SEEDED_LANGUAGE,
    });
    if (!service) throw new Error("Could not seed a service");
    return { id: service.id, publicId: service.publicId, projectId: victim.project.id };
  },
  intact: async (ref) => {
    const [row] = await db.select().from(services).where(eq(services.id, ref.id));
    return row?.language === SEEDED_LANGUAGE;
  },
  cases: {
    read: {
      attempts: ({ actor, ref }) => ({ "by public id with the actor's organization": () => servicesRepository.getServiceById(ref.publicId, ref.projectId, actor.organization.id) }),
      owner: ({ owner, ref }) => servicesRepository.getServiceById(ref.publicId, ref.projectId, owner.organization.id),
    },
    update: {
      attempts: ({ actor, ref }) => ({ "change the language": () => servicesRepository.updateService(ref.id, actor.organization.id, { language: "Go" }) }),
      owner: ({ owner, ref }) => servicesRepository.updateService(ref.id, owner.organization.id, { language: SEEDED_LANGUAGE }),
    },
    delete: {
      checksResult: false,
      attempts: ({ actor, ref }) => ({ remove: () => servicesRepository.deleteService(ref.id, actor.organization.id) }),
      owner: ({ owner, ref }) => servicesRepository.deleteService(ref.id, owner.organization.id),
    },
  },
};

export const serviceResource = defineResource(resource);
