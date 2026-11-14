import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import type { TenantRequest } from "../middleware/tenant-context.middleware";

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
