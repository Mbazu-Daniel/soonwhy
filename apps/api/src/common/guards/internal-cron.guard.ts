import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { timingSafeEqual } from "crypto";
import type { Request } from "express";
import { INTERNAL_CRON_HEADER } from "./internal-cron.constants";

function providedToken(request: Request): string | undefined {
  const value = request.headers[INTERNAL_CRON_HEADER];
  return Array.isArray(value) ? value[0] : value;
}

function tokensEqual(expected: string, provided: string): boolean {
  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(provided);
  if (expectedBuffer.length !== providedBuffer.length) return false;
  return timingSafeEqual(expectedBuffer, providedBuffer);
}

@Injectable()
export class InternalCronGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const expected = process.env.INTERNAL_CRON_SECRET;
    if (!expected) {
      throw new UnauthorizedException("Internal token required");
    }

    const provided = providedToken(context.switchToHttp().getRequest<Request>());
    if (!provided || !tokensEqual(expected, provided)) {
      throw new UnauthorizedException("Internal token invalid");
    }

    return true;
  }
}
