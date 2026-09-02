import { Injectable, NestMiddleware, UnauthorizedException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { auth } from '../config/better-auth.config';
import { db } from '../db';
import { sql } from 'drizzle-orm';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const authApi = auth.api as any;

export interface TenantRequest extends Request {
  user?: {
    id: string;
    email: string;
    name: string | null;
    image?: string | null;
    emailVerified: boolean;
  };
  orgId?: string;
  userRole?: string;
}

@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
  async use(req: TenantRequest, _res: Response, next: NextFunction) {
    const authorization = req.headers.authorization;

    if (!authorization) {
      next();
      return;
    }

    const token = authorization.replace('Bearer ', '');

    const session = await authApi.getSession({
      headers: { authorization: `Bearer ${token}` },
    });

    if (!session?.user) {
      next();
      return;
    }

    req.user = session.user;

    const orgId = req.headers['x-org-id'] as string || req.query.org_id as string;

    if (orgId) {
      const member = await authApi.getActiveMember({
        headers: { authorization: `Bearer ${token}` },
      });

      if (!member || member.organizationId !== orgId) {
        throw new UnauthorizedException('Not a member of this organization');
      }

      await db.execute(
        sql`SELECT set_config('app.org_id', ${orgId}, true)`
      );

      req.orgId = orgId;
      req.userRole = member.role;
    }

    next();
  }
}
