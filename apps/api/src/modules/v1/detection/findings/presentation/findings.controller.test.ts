import "reflect-metadata";
import { describe, expect, it, vi } from "vitest";
import { NotFoundException } from "@nestjs/common";
import { FindingsController } from "./findings.controller";
import { FindingsService } from "../application/findings.service";

const org = { orgId: "org_1", userRole: "member" };
const user = { id: "user_1", email: "a@b.c", name: null, image: null, emailVerified: true };

function setup(row: unknown) {
  const repository = {
    list: vi.fn().mockResolvedValue([]),
    find: vi.fn().mockResolvedValue(row),
    setStatus: vi.fn().mockResolvedValue(row),
    summary: vi.fn().mockResolvedValue([]),
    reportRows: vi.fn().mockResolvedValue([]),
  };
  const controller = new FindingsController(new FindingsService(repository as unknown as ConstructorParameters<typeof FindingsService>[0]));
  return { repository, controller };
}

describe("FindingsController", () => {
  it("parses list filters before querying", async () => {
    const { repository, controller } = setup({});
    await controller.list(org, "proj_1", { status: "open", category: "error", limit: "10" });
    expect(repository.list).toHaveBeenCalledWith("org_1", "proj_1", { status: "open", category: "error", limit: 10, offset: 0 });
  });

  it("rejects a bad filter", () => {
    const { controller } = setup({});
    expect(() => controller.list(org, "proj_1", { status: "nope" })).toThrow();
  });

  it("records who resolved a finding", async () => {
    const { repository, controller } = setup({ id: "f1" });
    await controller.setStatus(org, user, "proj_1", "f1", { status: "resolved" });
    expect(repository.setStatus).toHaveBeenCalledWith("org_1", "proj_1", "f1", "resolved", "user_1");
  });

  it("answers not found for a finding outside the project", async () => {
    const { controller } = setup(undefined);
    await expect(controller.get(org, "proj_1", "missing")).rejects.toBeInstanceOf(NotFoundException);
    await expect(controller.setStatus(org, user, "proj_1", "missing", { status: "resolved" })).rejects.toBeInstanceOf(NotFoundException);
  });

  it("builds the report for the requested number of days and rejects a longer one", async () => {
    const { repository, controller } = setup({});
    const report = await controller.report(org, "proj_1", { days: "30" });
    expect(report.totals.open).toBe(0);
    const from = repository.reportRows.mock.calls[0]![2] as Date;
    expect(Date.now() - from.getTime()).toBeGreaterThan(29 * 86_400_000);
    expect(() => controller.report(org, "proj_1", { days: "400" })).toThrow();
  });
});
