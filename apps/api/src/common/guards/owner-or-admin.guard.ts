import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import type { TenantRequest } from "../middleware/tenant-context.middleware";

/**
 * Restricts an org-scoped route to organisation owners and admins.
 * Relies on TenantContextMiddleware having set req.orgId/req.userRole
 * (i.e. applies under /organization/:organizationId/*). Run after TenantGuard.
 */
@Injectable()
export class OwnerOrAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<TenantRequest>();
    const role = request?.userRole ?? "member";

    if (role !== "owner" && role !== "admin") {
      throw new ForbiddenException("Only owners and admins can view this");
    }

    return true;
  }
}
