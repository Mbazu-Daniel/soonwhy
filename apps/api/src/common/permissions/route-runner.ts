import "reflect-metadata";
import { CanActivate, ForbiddenException, UnauthorizedException } from "@nestjs/common";
import { ORGANIZATION_ID } from "./constants";
import { guardsFor, handlerArguments } from "./route-inventory";
import type { RouteCaller, RouteOutcome, WriteRoute } from "./types";

export function stubService(): unknown {
  const stub: unknown = new Proxy(function stubTarget() {}, {
    get: (_target, property) => (property === "then" ? undefined : stub),
    apply: () => Promise.resolve(stub),
    construct: () => ({}),
  });
  return stub;
}

function requestFor(caller: RouteCaller): Record<string, unknown> {
  return {
    headers: {},
    ip: "127.0.0.1",
    orgId: caller.inOrganization ? ORGANIZATION_ID : undefined,
    userRole: caller.inOrganization ? caller.role : undefined,
    user: caller.signedIn ? { id: "user_1", email: "member@example.com", name: "Member" } : undefined,
  };
}

function isRejection(error: unknown): boolean {
  return error instanceof ForbiddenException || error instanceof UnauthorizedException;
}

async function passesGuards(route: WriteRoute, request: Record<string, unknown>): Promise<boolean> {
  const context = { switchToHttp: () => ({ getRequest: () => request }) } as never;
  for (const Guard of guardsFor(route)) {
    const guard = new (Guard as new () => CanActivate)();
    try {
      if (!(await guard.canActivate(context))) return false;
    } catch (error) {
      if (isRejection(error)) return false;
      throw error;
    }
  }
  return true;
}

export async function runGuards(route: WriteRoute, caller: RouteCaller): Promise<RouteOutcome> {
  return (await passesGuards(route, requestFor(caller))) ? "allowed" : "rejected";
}

export async function runRoute(route: WriteRoute, caller: RouteCaller): Promise<RouteOutcome> {
  const request = requestFor(caller);
  if (!(await passesGuards(route, request))) return "rejected";
  const parameters = route.controller.length;
  const instance = new (route.controller as new (...args: unknown[]) => Record<string, (...args: unknown[]) => unknown>)(
    ...Array.from({ length: parameters }, stubService),
  );
  try {
    await instance[route.handlerName](...handlerArguments(route, request));
    return "allowed";
  } catch (error) {
    return isRejection(error) ? "rejected" : "allowed";
  }
}
