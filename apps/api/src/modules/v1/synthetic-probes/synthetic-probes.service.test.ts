import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SyntheticProbesService } from "./synthetic-probes.service";

vi.mock("./probe-http.js", () => ({
  httpProbe: vi.fn(),
}));

vi.mock("./probe-ssrf.js", async (importOriginal) => {
  const original = await importOriginal<typeof import("./probe-ssrf.js")>();
  return {
    ...original,
    assertPublicDns: vi.fn(async () => {}),
  };
});

import { httpProbe } from "./probe-http.js";
import { assertPublicDns } from "./probe-ssrf.js";

const mockedProbe = vi.mocked(httpProbe);
const mockedAssertDns = vi.mocked(assertPublicDns);

function memoryRepo() {
  const probes: any[] = [];
  const results: any[] = [];
  let id = 0;
  let resultId = 0;

  return {
    probes,
    results,
    createProbe: vi.fn(async (orgId: string, projectId: string, input: any) => {
      id += 1;
      const probe = {
        id,
        orgId,
        projectId,
        name: input.name,
        url: input.url,
        method: input.method ?? "GET",
        headers: input.headers ?? {},
        body: input.body ?? null,
        expectedStatusCode: input.expectedStatusCode ?? 200,
        timeoutMs: input.timeoutMs ?? 5000,
        intervalSeconds: input.intervalSeconds ?? 60,
        enabled: true,
        region: "us-east-1",
        lastStatus: "unknown",
        uptimePercent: 100,
        totalChecks: 0,
        failedChecks: 0,
        lastCheckAt: null as Date | null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      probes.push(probe);
      return probe;
    }),
    getProbes: vi.fn(async (orgId: string, projectId: string) =>
      probes.filter((p) => p.orgId === orgId && p.projectId === projectId)),
    getProbeById: vi.fn(async (probeId: number) =>
      probes.find((p) => p.id === probeId)),
    updateProbe: vi.fn(async (probeId: number, input: any) => {
      const probe = probes.find((p) => p.id === probeId);
      Object.assign(probe, input, { updatedAt: new Date() });
      return probe;
    }),
    deleteProbe: vi.fn(async (probeId: number) => {
      const i = probes.findIndex((p) => p.id === probeId);
      if (i >= 0) probes.splice(i, 1);
    }),
    createResult: vi.fn(async (probeId: number, result: any) => {
      resultId += 1;
      results.push({ id: resultId, probeId, ...result, checkedAt: new Date() });
    }),
    getProbeResults: vi.fn(async (probeId: number, limit = 100) =>
      results
        .filter((r) => r.probeId === probeId)
        .slice()
        .sort((a, b) => b.checkedAt.getTime() - a.checkedAt.getTime())
        .slice(0, limit)),
    updateProbeStats: vi.fn(async (probeId: number, stats: any) => {
      const probe = probes.find((p) => p.id === probeId);
      Object.assign(probe, stats);
    }),
    getDueProbes: vi.fn(async () =>
      probes.filter(
        (p) =>
          p.enabled &&
          (!p.lastCheckAt ||
            new Date(p.lastCheckAt).getTime() + p.intervalSeconds * 1000 < Date.now()),
      )),
    cleanupOldResults: vi.fn(async () => 0),
  };
}

async function seedProbe(
  repository: ReturnType<typeof memoryRepo>,
  overrides: Record<string, unknown> = {},
) {
  const probe = await repository.createProbe("org", "project", {
    name: "web",
    url: "https://app.example.com/health",
    ...overrides,
  });
  return probe;
}

describe("SyntheticProbesService", () => {
  let repository: ReturnType<typeof memoryRepo>;
  let service: SyntheticProbesService;

  beforeEach(() => {
    repository = memoryRepo();
    service = new SyntheticProbesService(repository as never);
    mockedProbe.mockReset();
    mockedAssertDns.mockReset();
    mockedAssertDns.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("rejects probes targeting literal private IPs before DNS", async () => {
    await expect(
      service.createProbe("org", "project", {
        name: "x",
        url: "http://127.0.0.1:8080/health",
      } as never),
    ).rejects.toThrow(/Private or reserved/);
    expect(repository.probes).toHaveLength(0);
    expect(mockedAssertDns).not.toHaveBeenCalled();
  });

  it("rejects a probe URL with embedded credentials", async () => {
    await expect(
      service.createProbe("org", "project", {
        name: "x",
        url: "https://user:pass@example.com/health",
      } as never),
    ).rejects.toThrow(/credentials/);
  });

  it("flips unknown to up after two consecutive successful checks", async () => {
    mockedProbe.mockResolvedValue({ statusCode: 200, responseTimeMs: 42 });
    const probe = await seedProbe(repository);

    await service.executeProbe(probe);
    expect(probe.lastStatus).toBe("unknown");

    await service.executeProbe(probe);
    expect(probe.lastStatus).toBe("up");
  });

  it("flips up to down after two consecutive failed checks", async () => {
    mockedProbe.mockResolvedValue({ statusCode: 500, responseTimeMs: 30 });
    const probe = await seedProbe(repository, { intervalSeconds: 60 });
    await repository.updateProbeStats(probe.id, {
      lastStatus: "up",
      uptimePercent: 100,
      totalChecks: 5,
      failedChecks: 0,
      lastCheckAt: new Date(Date.now() - 60 * 60 * 1000),
    });
    probe.lastStatus = "up";

    await service.executeProbe(probe);
    expect(probe.lastStatus).toBe("up");

    await service.executeProbe(probe);
    expect(probe.lastStatus).toBe("down");
  });

  it("marks a failing probe down when the worker errors", async () => {
    mockedProbe.mockRejectedValue(new Error("Request timeout after 5000ms"));
    const probe = await seedProbe(repository);
    await repository.updateProbeStats(probe.id, {
      lastStatus: "up",
      uptimePercent: 100,
      totalChecks: 5,
      failedChecks: 0,
      lastCheckAt: new Date(Date.now() - 60 * 60 * 1000),
    });
    probe.lastStatus = "up";

    await service.executeProbe(probe);
    await service.executeProbe(probe);
    expect(probe.lastStatus).toBe("down");
  });

  it("degraded responses count as failures for the streak", async () => {
    mockedProbe.mockResolvedValue({ statusCode: 418, responseTimeMs: 10 });
    const probe = await seedProbe(repository);
    await repository.updateProbeStats(probe.id, {
      lastStatus: "up",
      uptimePercent: 100,
      totalChecks: 5,
      failedChecks: 0,
      lastCheckAt: new Date(Date.now() - 60 * 60 * 1000),
    });
    probe.lastStatus = "up";

    await service.executeProbe(probe);
    await service.executeProbe(probe);
    expect(probe.lastStatus).toBe("down");
  });

  it("hides stale monitors as unknown even if they were up", async () => {
    const stale = new Date(Date.now() - 10 * 60 * 1000);
    const stored = await repository.createProbe("org", "project", {
      name: "x",
      url: "https://app.example.com/health",
    });
    await repository.updateProbeStats(stored.id, {
      lastStatus: "up",
      uptimePercent: 99,
      totalChecks: 50,
      failedChecks: 0,
      lastCheckAt: stale,
    });

    const decorated = await service.getProbeById(stored.id);
    expect(decorated?.lastStatus).toBe("unknown");
  });

  it("runs only due probes and reports a summary", async () => {
    mockedProbe.mockResolvedValue({ statusCode: 200, responseTimeMs: 10 });
    const due = await repository.createProbe("org", "project", {
      name: "due",
      url: "https://due.example.com/health",
    });
    const fresh = await repository.createProbe("org", "project", {
      name: "fresh",
      url: "https://fresh.example.com/health",
    });
    await repository.updateProbeStats(fresh.id, {
      lastStatus: "up",
      uptimePercent: 100,
      totalChecks: 10,
      failedChecks: 0,
      lastCheckAt: new Date(),
    });

    const summary = await service.runDueProbes();

    expect(summary.due).toBe(1);
    expect(summary.executed).toBe(1);
    expect(summary.failed).toBe(0);
    const ran = repository.probes.find((p) => p.id === due.id);
    const skipped = repository.probes.find((p) => p.id === fresh.id);
    expect(ran.lastCheckAt).not.toBeNull();
    expect(skipped.lastCheckAt?.getTime()).toBeLessThanOrEqual(Date.now());
  });
});
