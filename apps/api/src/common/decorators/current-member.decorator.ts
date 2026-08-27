import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { TenantRequest } from '../middleware/tenant-context.middleware';

export interface MemberContext {
  userId: string;
  orgId: string;
  role: string;
}

export const CurrentMember = createParamDecorator(
  (data: keyof MemberContext | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<TenantRequest>();

    if (!request.user || !request.orgId) {
      return null;
    }

    const member: MemberContext = {
      userId: request.user.id,
      orgId: request.orgId,
      role: request.userRole ?? 'member',
    };

    return data ? member[data] : member;
  },
);
