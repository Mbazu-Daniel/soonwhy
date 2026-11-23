import "reflect-metadata";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { METHOD_METADATA, PATH_METADATA, ROUTE_ARGS_METADATA } from "@nestjs/common/constants";
import { loadControllers } from "./route-inventory";
import { PARAM_ROUTE_ARGUMENT } from "./constants";

vi.hoisted(() => {
  process.env.BETTER_AUTH_SECRET ??= "project-scope-routes-test-secret";
});

vi.mock("../db", async (importOriginal) => {
  const original = await importOriginal<Record<string, unknown>>();
  return { ...original, db: {} };
});

const first = (value: unknown) => (Array.isArray(value) ? String(value[0] ?? "") : String(value ?? ""));

describe("project scoped routes", () => {
  let controllers: Function[] = [];
  beforeAll(async () => {
    controllers = await loadControllers();
  }, 180_000);

  it("takes every project identifier from a /projects/:id path segment that tenant context verifies", () => {
    const offenders: string[] = [];
    for (const controller of controllers) {
      const prefix = first(Reflect.getMetadata(PATH_METADATA, controller));
      for (const name of Object.getOwnPropertyNames(controller.prototype)) {
        const handler = controller.prototype[name];
        if (typeof handler !== "function" || Reflect.getMetadata(METHOD_METADATA, handler) === undefined) continue;
        const path = `${prefix}/${first(Reflect.getMetadata(PATH_METADATA, handler))}`;
        if (path.startsWith("public/") || path.startsWith("github/webhook/")) continue;
        const args = (Reflect.getMetadata(ROUTE_ARGS_METADATA, controller, name) ?? {}) as Record<string, { data?: unknown }>;
        for (const [key, entry] of Object.entries(args)) {
          if (!key.startsWith(`${PARAM_ROUTE_ARGUMENT}:`) || typeof entry.data !== "string") continue;
          if (!/project/i.test(entry.data)) continue;
          if (!path.includes(`projects/:${entry.data}`)) offenders.push(`${controller.name}.${name} :${entry.data} in ${path}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
