import { beforeEach, describe, expect, it, vi } from "vitest";

const store = vi.hoisted(() => ({
  settings: { enabled: true, dailyCap: 2, minOccurrences: 5 },
  used: 0,
  projects: ["p1"],
}));

vi.mock("./auto-analysis.store", () => ({
  getSettings: async () => store.settings,
  countAutoAnalysesSince: async () => store.used,
  listProjectIds: async () => store.projects,
  listEnabledOrgIds: async () => ["org"],
}));

import { AutoAnalysisService } from "./auto-analysis.service";
import { evidenceHash } from "./evidence-hash";

const group = (fingerprint: string, errorType: string, count: number) => ({
  fingerprint,
  errorType,
  count,
  scannerProbe: false,
  issue: { status: "unresolved" as const, resolvedAt: null },
});

const findingOf = (id: string, severity = "warning") => ({ id, title: `t-${id}`, serviceName: "api", severity, evidence: [] });

const source = vi.hoisted(() => ({ value: "platform" as "platform" | "byok" }));

function build(groups: ReturnType<typeof group>[], latest: Record<string, { evidenceHash: string | null } | undefined> = {}, severities: Record<string, string> = {}) {
  const errors = {
    listGroups: vi.fn(async () => groups),
    createFinding: vi.fn(async (_o: string, _p: string, fingerprint: string) => ({ status: "created" as const, finding: findingOf(fingerprint, severities[fingerprint]) })),
  };
  const rca = {
    getLatest: vi.fn(async (_o: string, _p: string, findingId: string) => latest[findingId]),
    generate: vi.fn(async () => ({ id: "an1", summary: "s", rootCause: "c", suggestedChanges: ["fix"], confidence: "high" })),
  };
  const credentials = { describe: vi.fn(async () => ({ source: source.value })) };
  const notifications = { dispatchAlert: vi.fn(async () => ({ sent: 1, failed: 0, results: [] })) };
  return { service: new AutoAnalysisService(errors as never, rca as never, credentials as never, notifications as never), errors, rca, notifications };
}

beforeEach(() => {
  store.settings = { enabled: true, dailyCap: 2, minOccurrences: 5 };
  store.used = 0;
  store.projects = ["p1"];
  source.value = "platform";
});

describe("AutoAnalysisService", () => {
  it("does nothing when the switch is off", async () => {
    store.settings.enabled = false;
    const { service, errors } = build([group("a", "HTTP 500", 9)]);
    const run = await service.runOrg("org");
    expect(run.analyzed).toBe(0);
    expect(errors.listGroups).not.toHaveBeenCalled();
  });

  it("analyzes a meaningful group and tags it as automatic with its evidence hash", async () => {
    const { service, rca } = build([group("a", "HTTP 500", 9)]);
    await service.runOrg("org");
    expect(rca.generate).toHaveBeenCalledWith("org", "p1", "a", false, undefined, {
      trigger: "auto",
      evidenceHash: evidenceHash(findingOf("a")),
    });
  });

  it("never analyzes a 404 or a quiet 4xx", async () => {
    const { service, rca } = build([group("a", "HTTP 404", 900), group("b", "HTTP 422", 2)]);
    await service.runOrg("org");
    expect(rca.generate).not.toHaveBeenCalled();
  });

  it("analyzes a group once and skips it while the evidence is unchanged", async () => {
    const hash = evidenceHash(findingOf("a"));
    const { service, rca } = build([group("a", "HTTP 500", 9)], { a: { evidenceHash: hash } });
    const run = await service.runOrg("org");
    expect(rca.generate).not.toHaveBeenCalled();
    expect(run.skipped).toBe(1);
  });

  it("re-runs when the evidence changed", async () => {
    const { service, rca } = build([group("a", "HTTP 500", 9)], { a: { evidenceHash: "old" } });
    await service.runOrg("org");
    expect(rca.generate).toHaveBeenCalledWith("org", "p1", "a", true, undefined, expect.objectContaining({ trigger: "auto" }));
  });

  it("leaves a manual analysis alone", async () => {
    const { service, rca } = build([group("a", "HTTP 500", 9)], { a: { evidenceHash: null } });
    await service.runOrg("org");
    expect(rca.generate).not.toHaveBeenCalled();
  });

  it("stops at the daily cap, counting analyses already run today", async () => {
    store.used = 1;
    const { service, rca } = build([group("a", "HTTP 500", 9), group("b", "HTTP 500", 8), group("c", "HTTP 500", 7)]);
    const run = await service.runOrg("org");
    expect(rca.generate).toHaveBeenCalledTimes(1);
    expect(run.capReached).toBe(true);
  });

  it("does not run at all once the cap is already used", async () => {
    store.used = 2;
    const { service, errors } = build([group("a", "HTTP 500", 9)]);
    await service.runOrg("org");
    expect(errors.listGroups).not.toHaveBeenCalled();
  });

  it("keeps going after one group fails and does not spend the cap on it", async () => {
    const { service, rca } = build([group("a", "HTTP 500", 9), group("b", "HTTP 500", 8)]);
    rca.generate.mockRejectedValueOnce(new Error("provider down"));
    const run = await service.runOrg("org");
    expect(run.failed).toBe(1);
    expect(run.analyzed).toBe(1);
  });

  it("applies no cap when the organization uses its own key", async () => {
    source.value = "byok";
    store.used = 999;
    const { service, rca } = build([group("a", "HTTP 500", 9), group("b", "HTTP 500", 8), group("c", "HTTP 500", 7)]);
    const run = await service.runOrg("org");
    expect(rca.generate).toHaveBeenCalledTimes(3);
    expect(run.capReached).toBe(false);
  });

  it("notifies when a critical group has been analyzed", async () => {
    const { service, notifications } = build([group("a", "HTTP 500", 9)], {}, { a: "critical" });
    await service.runOrg("org");
    expect(notifications.dispatchAlert).toHaveBeenCalledWith(
      expect.objectContaining({ orgId: "org", projectId: "p1", incidentId: "auto-analysis-an1", severity: "critical" }),
    );
  });

  it("does not notify for a warning group", async () => {
    const { service, notifications } = build([group("a", "HTTP 500", 9)]);
    await service.runOrg("org");
    expect(notifications.dispatchAlert).not.toHaveBeenCalled();
  });

  it("still counts the analysis when the notification fails", async () => {
    const { service, notifications } = build([group("a", "HTTP 500", 9)], {}, { a: "critical" });
    notifications.dispatchAlert.mockRejectedValueOnce(new Error("smtp down"));
    const run = await service.runOrg("org");
    expect(run.analyzed).toBe(1);
    expect(run.failed).toBe(0);
  });

  it("stops analysing once the run's time budget is spent", async () => {
    const { service, rca } = build([group("a", "HTTP 500", 9), group("b", "HTTP 500", 8)]);
    const run = await service.runOrg("org", new Date(), Date.now() - 1);
    expect(run.analyzed).toBe(0);
    expect(rca.generate).not.toHaveBeenCalled();
  });
});
