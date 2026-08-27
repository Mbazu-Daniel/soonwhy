import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { TenantRequest } from '../middleware/tenant-context.middleware';

export interface OrgContext {
  orgId: string;
  userRole: string;
}

export const CurrentOrg = createParamDecorator(
  (data: keyof OrgContext | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<TenantRequest>();

    if (!data) {
      return {
        orgId: request.orgId,
        userRole: request.userRole,
      } as OrgContext;
    }

    return data === 'orgId' ? request.orgId : request.userRole;
  },
);
