import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { TenantRequest } from "../middleware/tenant-context.middleware.types";
import type { AuthUser } from "./current-user.decorator.types";

export const CurrentUser = createParamDecorator(
  (data: keyof AuthUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<TenantRequest>();
    const user = request.user;

    if (!user) {
      return null;
    }

    return data ? user[data] : user;
  },
);

export function actorLabel(user: Pick<AuthUser, "name" | "email"> | null | undefined): string {
  return user?.name?.trim() || user?.email || "unknown";
}
