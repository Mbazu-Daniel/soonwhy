import { randomUUID } from "node:crypto";
import type { ExecutionContext } from "@nestjs/common";
import { db } from "../../src/common/db";
import { users } from "../../src/common/db/schema/auth";
import { PLATFORM_ROLE } from "../../src/common/guards/platform-admin.guard.constants";
import { createOrganization as insertOrganization, createProject } from "../support/fixtures";
import type { TestOrganization } from "./types";

export async function createUser(label: string, platformRole: string = PLATFORM_ROLE.NONE): Promise<string> {
  const [user] = await db
    .insert(users)
    .values({ email: `${label}-${randomUUID()}@example.test`, platformRole })
    .returning({ id: users.id });
  if (!user) throw new Error(`Could not create user ${label}`);
  return user.id;
}

export async function createTestOrganization(label: string): Promise<TestOrganization> {
  const organization = await insertOrganization();
  if (!organization) throw new Error(`Could not create organization ${label}`);
  const project = await createProject(organization.id);
  if (!project) throw new Error(`Could not create project for ${label}`);
  return { organization, project, userId: await createUser(label) };
}

export function requestFor(userId: string): ExecutionContext {
  return { switchToHttp: () => ({ getRequest: () => ({ user: { id: userId } }) }) } as unknown as ExecutionContext;
}

export const rowsWithId = <Id extends string | number>(rows: ReadonlyArray<{ id: Id }>, wanted: Id) => rows.filter((row) => row.id === wanted);
