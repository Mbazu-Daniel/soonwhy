import { RequestMethod } from "@nestjs/common/enums/request-method.enum";
import { describe, expect, it } from "vitest";
import { PlatformAdminGuard, SuperAdminGuard } from "../../src/common/guards/platform-admin.guard";
import { DlqController } from "../../src/modules/v1/telemetry/dlq/presentation/dlq.controller";
import { NEST_GUARDS_METADATA, NEST_METHOD_METADATA } from "./constants";

const handlerNames = Object.getOwnPropertyNames(DlqController.prototype).filter((name) => name !== "constructor");
const handlerOf = (name: string): object => Reflect.get(DlqController.prototype, name) as object;
const guardNames = (target: object) => ((Reflect.getMetadata(NEST_GUARDS_METADATA, target) as Array<{ name: string }> | undefined) ?? []).map((guard) => guard.name);

describe("dead-letter routes are staff-only", () => {
  it("guards the whole controller with the platform admin guard", () => {
    expect(guardNames(DlqController)).toContain(PlatformAdminGuard.name);
  });

  it("also requires a super admin for every route that changes data", () => {
    const mutating = handlerNames.filter((name) => Reflect.getMetadata(NEST_METHOD_METADATA, handlerOf(name)) !== RequestMethod.GET);

    expect(mutating.length).toBeGreaterThan(0);
    for (const name of mutating) {
      expect(guardNames(handlerOf(name)), `${name} must require a super admin`).toContain(SuperAdminGuard.name);
    }
  });
});
