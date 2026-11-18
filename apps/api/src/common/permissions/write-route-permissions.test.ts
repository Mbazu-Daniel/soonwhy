import { beforeAll, describe, expect, it, vi } from "vitest";
import { OwnerOrAdminGuard } from "../guards/owner-or-admin.guard";
import { PlatformAdminGuard, SuperAdminGuard } from "../guards/platform-admin.guard";
import { TenantGuard } from "../middleware/tenant-context.guard";
import { CONTROLLER_POLICY, ROUTE_POLICY_OVERRIDES } from "./constants";
import { guardsFor, loadControllers, writeRoutes } from "./route-inventory";
import { runGuards, runRoute } from "./route-runner";
import type { RoutePolicy, WriteRoute } from "./types";

vi.hoisted(() => {
  process.env.BETTER_AUTH_SECRET ??= "write-route-permissions-test-secret";
});

vi.mock("../db", async (importOriginal) => {
  const original = await importOriginal<Record<string, unknown>>();
  const failing = new Proxy({}, {
    get: () => () => {
      throw new Error("database is not available in this test");
    },
  });
  return { ...original, db: failing };
});

const MEMBER = { role: "member", signedIn: true, inOrganization: true };
const ADMIN = { role: "admin", signedIn: true, inOrganization: true };
const OWNER = { role: "owner", signedIn: true, inOrganization: true };
const ANONYMOUS = { role: undefined, signedIn: false, inOrganization: false };

let routes: WriteRoute[] = [];

function policyOf(route: WriteRoute): RoutePolicy | undefined {
  return ROUTE_POLICY_OVERRIDES[`${route.controllerName}.${route.handlerName}`] ?? CONTROLLER_POLICY[route.controllerName];
}

function routesWith(policy: RoutePolicy): WriteRoute[] {
  return routes.filter((route) => policyOf(route) === policy);
}

beforeAll(async () => {
  routes = writeRoutes(await loadControllers());
}, 400_000);

describe("write route permissions", () => {
  it("has a declared policy for every write route", () => {
    const undeclared = routes.filter((route) => !policyOf(route)).map((route) => `${route.controllerName}.${route.handlerName}`);
    expect(undeclared).toEqual([]);
  });

  it("declares no policy for a controller or route that no longer exists", () => {
    const controllers = new Set(routes.map((route) => route.controllerName));
    const handlers = new Set(routes.map((route) => `${route.controllerName}.${route.handlerName}`));
    expect(Object.keys(CONTROLLER_POLICY).filter((name) => !controllers.has(name))).toEqual([]);
    expect(Object.keys(ROUTE_POLICY_OVERRIDES).filter((name) => !handlers.has(name))).toEqual([]);
  });

  it("rejects a plain member on every admin route", async () => {
    const accepted: string[] = [];
    for (const route of routesWith("admin")) {
      if ((await runRoute(route, MEMBER)) !== "rejected") accepted.push(`${route.key} (${route.controllerName}.${route.handlerName})`);
    }
    expect(accepted).toEqual([]);
  });

  it("lets an owner past the role check on every admin route", async () => {
    const refused: string[] = [];
    for (const route of routesWith("admin")) {
      if ((await runRoute(route, OWNER)) !== "allowed") refused.push(`${route.key} (${route.controllerName}.${route.handlerName})`);
    }
    expect(refused).toEqual([]);
  });

  it("rejects a request with no sign-in on every admin and member route", async () => {
    const accepted: string[] = [];
    for (const route of [...routesWith("admin"), ...routesWith("member")]) {
      if ((await runGuards(route, ANONYMOUS)) !== "rejected") accepted.push(`${route.key} (${route.controllerName}.${route.handlerName})`);
    }
    expect(accepted).toEqual([]);
  });

  it("lets a plain member through the guards on every member route", async () => {
    const refused: string[] = [];
    for (const route of routesWith("member")) {
      if ((await runGuards(route, MEMBER)) !== "allowed") refused.push(`${route.key} (${route.controllerName}.${route.handlerName})`);
    }
    expect(refused).toEqual([]);
  });

  it("lets an admin through the guards on every member route", async () => {
    const refused: string[] = [];
    for (const route of routesWith("member")) {
      if ((await runGuards(route, ADMIN)) !== "allowed") refused.push(`${route.key} (${route.controllerName}.${route.handlerName})`);
    }
    expect(refused).toEqual([]);
  });

  it("protects every platform route with the platform admin and super admin guards", () => {
    for (const route of routesWith("platform")) {
      const guards = guardsFor(route);
      expect(guards, route.key).toContain(PlatformAdminGuard);
      expect(guards, route.key).toContain(SuperAdminGuard);
    }
  });

  it("uses the tenant guard on every route that is not public or unguarded", () => {
    const missing = routes
      .filter((route) => ["admin", "member"].includes(policyOf(route) ?? ""))
      .filter((route) => !guardsFor(route).includes(TenantGuard))
      .map((route) => route.key);
    expect(missing).toEqual([]);
  });

  it("names the routes that accept a request with no sign-in", async () => {
    const open: string[] = [];
    for (const route of routes) {
      if (["public", "unguarded"].includes(policyOf(route) ?? "") && (await runGuards(route, ANONYMOUS)) === "allowed") {
        open.push(route.controllerName);
      }
    }
    const expected = routes
      .filter((route) => ["public", "unguarded"].includes(policyOf(route) ?? ""))
      .map((route) => route.controllerName);
    expect(open).toEqual(expected);
  });

  it("puts the owner and admin guard on the detector configuration writes", () => {
    const writes = routes.filter((route) => ["DetectorSettingsController", "DetectorConfigController"].includes(route.controllerName));
    expect(writes.length).toBeGreaterThan(0);
    for (const route of writes) expect(guardsFor(route), route.key).toContain(OwnerOrAdminGuard);
  });
});
