import { RequestMethod } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { DlqController } from "./dlq.controller";

function routes() {
  return Object.getOwnPropertyNames(DlqController.prototype)
    .filter((name) => name !== "constructor")
    .map((name) => {
      const handler = (DlqController.prototype as unknown as Record<string, object>)[name]!;
      return {
        name,
        method: Reflect.getMetadata("method", handler) as RequestMethod,
        path: Reflect.getMetadata("path", handler) as string,
      };
    });
}

describe("DlqController route order", () => {
  it("registers literal paths before the parameterised path of the same method", () => {
    const all = routes();

    for (const [index, route] of all.entries()) {
      if (!route.path.startsWith(":") || route.path.includes("/")) continue;
      const shadowed = all.slice(index + 1).filter((later) => later.method === route.method && !later.path.includes(":"));
      expect(shadowed.map((later) => later.name)).toEqual([]);
    }
  });

  it("serves bulk delete on its own literal path", () => {
    expect(routes().find((route) => route.name === "bulkDelete")).toMatchObject({
      method: RequestMethod.DELETE,
      path: "bulk-delete",
    });
  });
});
