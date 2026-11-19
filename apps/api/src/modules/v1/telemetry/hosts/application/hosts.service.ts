import { Injectable, NotFoundException } from "@nestjs/common";
import { and, asc, eq } from "drizzle-orm";
import { db } from "../../../../../common/db";
import { hosts, projects } from "../../../../../common/db/schema";

const HOST_COLUMNS = {
  id: hosts.id,
  hostName: hosts.hostName,
  projectId: hosts.projectId,
  firstSeenAt: hosts.firstSeenAt,
  lastSeenAt: hosts.lastSeenAt,
};

@Injectable()
export class HostsService {
  async listForProject(orgId: string, projectId: string) {
    return db
      .select(HOST_COLUMNS)
      .from(hosts)
      .where(and(eq(hosts.organizationId, orgId), eq(hosts.projectId, projectId)))
      .orderBy(asc(hosts.hostName));
  }

  async moveHost(orgId: string, projectId: string, hostId: string, targetProjectId: string) {
    const [host] = await db
      .select({ id: hosts.id })
      .from(hosts)
      .where(and(eq(hosts.id, hostId), eq(hosts.organizationId, orgId), eq(hosts.projectId, projectId)));
    if (!host) throw new NotFoundException("Host not found");

    const [target] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, targetProjectId), eq(projects.organizationId, orgId)));
    if (!target) throw new NotFoundException("Project not found");

    const [moved] = await db
      .update(hosts)
      .set({ projectId: target.id })
      .where(eq(hosts.id, host.id))
      .returning(HOST_COLUMNS);
    return moved;
  }
}
