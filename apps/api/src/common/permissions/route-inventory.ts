import "reflect-metadata";
import { readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { CUSTOM_ROUTE_ARGS_METADATA, GUARDS_METADATA, METHOD_METADATA, PATH_METADATA, ROUTE_ARGS_METADATA } from "@nestjs/common/constants";
import { RequestMethod } from "@nestjs/common";
import { ORGANIZATION_ID, PARAM_ROUTE_ARGUMENT } from "./constants";
import type { WriteMethod, WriteRoute } from "./types";

const SOURCE_ROOT = resolve(__dirname, "..", "..");
const WRITE_METHODS: Partial<Record<number, WriteMethod>> = {
  [RequestMethod.POST]: "POST",
  [RequestMethod.PUT]: "PUT",
  [RequestMethod.PATCH]: "PATCH",
  [RequestMethod.DELETE]: "DELETE",
};

function controllerFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const full = join(directory, entry);
    if (statSync(full).isDirectory()) return controllerFiles(full);
    return entry.endsWith(".controller.ts") ? [full] : [];
  });
}

function joinPath(...parts: string[]): string {
  const joined = parts.map((part) => part.replace(/^\/+|\/+$/g, "")).filter(Boolean).join("/");
  return `/${joined}`;
}

function firstPath(value: unknown): string {
  return Array.isArray(value) ? String(value[0] ?? "") : String(value ?? "");
}

export async function loadControllers(): Promise<Function[]> {
  const files = controllerFiles(SOURCE_ROOT).sort();
  const modules = await Promise.all(files.map((file) => import(pathToFileURL(file).href)));
  return modules.flatMap((loaded) =>
    Object.values(loaded as Record<string, unknown>).filter(
      (value): value is Function =>
        typeof value === "function" && Reflect.hasMetadata(PATH_METADATA, value),
    ),
  );
}

export function writeRoutes(controllers: Function[]): WriteRoute[] {
  return controllers.flatMap((controller) => {
    const prefix = firstPath(Reflect.getMetadata(PATH_METADATA, controller));
    return Object.getOwnPropertyNames(controller.prototype).flatMap((handlerName) => {
      const handler = controller.prototype[handlerName];
      if (typeof handler !== "function" || handlerName === "constructor") return [];
      const method = WRITE_METHODS[Reflect.getMetadata(METHOD_METADATA, handler) as number];
      if (!method) return [];
      const path = joinPath(prefix, firstPath(Reflect.getMetadata(PATH_METADATA, handler)));
      return [{ key: `${method} ${path}`, controller, controllerName: controller.name, handlerName, method, path }];
    });
  });
}

export function guardsFor(route: WriteRoute): Function[] {
  const onClass = (Reflect.getMetadata(GUARDS_METADATA, route.controller) ?? []) as Function[];
  const onMethod = (Reflect.getMetadata(GUARDS_METADATA, route.controller.prototype[route.handlerName]) ?? []) as Function[];
  return [...onClass, ...onMethod];
}

export function handlerArguments(route: WriteRoute, request: Record<string, unknown>): unknown[] {
  const metadata = (Reflect.getMetadata(ROUTE_ARGS_METADATA, route.controller, route.handlerName) ?? {}) as Record<
    string,
    { index: number; data?: unknown; factory?: (data: unknown, context: unknown) => unknown }
  >;
  const context = { switchToHttp: () => ({ getRequest: () => request }) };
  const args: unknown[] = [];
  for (const [key, entry] of Object.entries(metadata)) {
    if (key.includes(CUSTOM_ROUTE_ARGS_METADATA) && entry.factory) {
      args[entry.index] = entry.factory(entry.data, context);
    } else if (key.startsWith(`${PARAM_ROUTE_ARGUMENT}:`)) {
      args[entry.index] = entry.data === "organizationId" ? ORGANIZATION_ID : "id_1";
    } else {
      args[entry.index] = {};
    }
  }
  return args;
}
