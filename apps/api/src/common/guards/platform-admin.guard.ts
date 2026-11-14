import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { users } from "../db/schema/auth";
import type { TenantRequest } from "../middleware/tenant-context.middleware";

export const PLATFORM_ROLE = {
  NONE: "none",
  ADMIN: "admin",
  SUPER_ADMIN: "super_admin",
} as const;
export type PlatformRole = (typeof PLATFORM_ROLE)[keyof typeof PLATFORM_ROLE];

export async function platformRoleFor(userId: string | undefined): Promise<PlatformRole> {
  if (!userId) return PLATFORM_ROLE.NONE;
  const rows = await db
    .select({ platformRole: users.platformRole })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  const role = rows[0]?.platformRole;
  return role === PLATFORM_ROLE.ADMIN || role === PLATFORM_ROLE.SUPER_ADMIN ? role : PLATFORM_ROLE.NONE;
}

@Injectable()
export class PlatformAdminGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<TenantRequest>();
    if (!request?.user?.id) {
      throw new UnauthorizedException("Sign in required");
    }
    const role = await platformRoleFor(request.user.id);
    if (role === PLATFORM_ROLE.NONE) {
      throw new ForbiddenException("Only Soonwhy staff can view this");
    }
    return true;
  }
}

@Injectable()
export class SuperAdminGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<TenantRequest>();
    if (!request?.user?.id) {
      throw new UnauthorizedException("Sign in required");
    }
    const role = await platformRoleFor(request.user.id);
    if (role !== PLATFORM_ROLE.SUPER_ADMIN) {
      throw new ForbiddenException("Only Soonwhy super_admins can view this");
    }
    return true;
  }
}
