import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { MaintenanceWindowsRepository } from "../../src/modules/v1/maintenance-windows/maintenance-windows.repository";
import { closeDatabase, databaseTestsEnabled, resetDatabase } from "../support/test-database";

describe.skipIf(!databaseTestsEnabled)("MaintenanceWindowsRepository", () => {
  const repository = new MaintenanceWindowsRepository();
  const now = new Date("2026-05-01T12:00:00.000Z");

  beforeEach(resetDatabase);
  afterAll(closeDatabase);

  it("lists windows for the project ordered by start time", async () => {
    await repository.createMaintenanceWindow({
      orgId: "org-1",
      projectId: "project-1",
      name: "later",
      startTime: new Date("2026-06-01T00:00:00.000Z"),
      endTime: new Date("2026-06-01T01:00:00.000Z"),
    });
    await repository.createMaintenanceWindow({
      orgId: "org-1",
      projectId: "project-1",
      name: "earlier",
      startTime: new Date("2026-04-01T00:00:00.000Z"),
      endTime: new Date("2026-04-01T01:00:00.000Z"),
    });
    await repository.createMaintenanceWindow({
      orgId: "org-2",
      projectId: "project-1",
      name: "other-org",
      startTime: new Date("2026-04-01T00:00:00.000Z"),
      endTime: new Date("2026-04-01T01:00:00.000Z"),
    });

    const windows = await repository.getMaintenanceWindows("org-1", "project-1");

    expect(windows.map((window) => window.name)).toEqual(["earlier", "later"]);
  });

  it("returns only windows active at the given timestamp", async () => {
    await repository.createMaintenanceWindow({
      orgId: "org-1",
      projectId: "project-1",
      name: "current",
      startTime: new Date("2026-05-01T11:00:00.000Z"),
      endTime: new Date("2026-05-01T13:00:00.000Z"),
    });
    await repository.createMaintenanceWindow({
      orgId: "org-1",
      projectId: "project-1",
      name: "future",
      startTime: new Date("2026-05-02T11:00:00.000Z"),
      endTime: new Date("2026-05-02T13:00:00.000Z"),
    });

    const active = await repository.getActiveMaintenanceWindows("org-1", "project-1", now);

    expect(active.map((window) => window.name)).toEqual(["current"]);
  });

  it("suppresses alerts matched by rule, service, or all alerts", async () => {
    await repository.createMaintenanceWindow({
      orgId: "org-1",
      projectId: "project-1",
      name: "targeted",
      startTime: new Date("2026-05-01T11:00:00.000Z"),
      endTime: new Date("2026-05-01T13:00:00.000Z"),
      affectedServices: ["checkout"],
      affectedAlertRules: ["rule-1"],
    });

    await expect(
      repository.isAlertSuppressed("org-1", "project-1", "rule-1", undefined, now),
    ).resolves.toBe(true);
    await expect(
      repository.isAlertSuppressed("org-1", "project-1", "rule-2", "checkout", now),
    ).resolves.toBe(true);
    await expect(
      repository.isAlertSuppressed("org-1", "project-1", "rule-2", "search", now),
    ).resolves.toBe(false);

    await repository.createMaintenanceWindow({
      orgId: "org-1",
      projectId: "project-1",
      name: "global",
      startTime: new Date("2026-05-01T11:00:00.000Z"),
      endTime: new Date("2026-05-01T13:00:00.000Z"),
    });

    await expect(
      repository.isAlertSuppressed("org-1", "project-1", "rule-2", "search", now),
    ).resolves.toBe(true);
  });

  it("does not suppress alerts outside the window", async () => {
    await repository.createMaintenanceWindow({
      orgId: "org-1",
      projectId: "project-1",
      name: "past",
      startTime: new Date("2026-04-01T00:00:00.000Z"),
      endTime: new Date("2026-04-01T01:00:00.000Z"),
    });

    await expect(
      repository.isAlertSuppressed("org-1", "project-1", "rule-1", "checkout", now),
    ).resolves.toBe(false);
  });

  it("updates and deletes a window", async () => {
    const window = await repository.createMaintenanceWindow({
      orgId: "org-1",
      projectId: "project-1",
      name: "initial",
      startTime: new Date("2026-05-01T11:00:00.000Z"),
      endTime: new Date("2026-05-01T13:00:00.000Z"),
    });

    const updated = await repository.updateMaintenanceWindow(window.id, {
      name: "renamed",
      isActive: false,
    });
    expect(updated).toMatchObject({ name: "renamed", isActive: false });

    await repository.deleteMaintenanceWindow(window.id);
    await expect(repository.getMaintenanceWindows("org-1", "project-1")).resolves.toEqual([]);
  });
});
