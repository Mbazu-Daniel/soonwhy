import { describe, expect, it } from "vitest";
import { detectAuthFailureSpikes, findSecretExposures } from "./security-signals";

describe("detectAuthFailureSpikes", () => {
  it("flags a service whose auth failures grew past the baseline", () => {
    const spikes = detectAuthFailureSpikes([{ service: "api", count: 80 }], [{ service: "api", count: 10 }]);
    expect(spikes).toEqual([{ service: "api", count: 80, baseline: 10, severity: "warning" }]);
  });

  it("is critical at high volume and ignores small or steady counts", () => {
    expect(detectAuthFailureSpikes([{ service: "api", count: 300 }], [])[0]?.severity).toBe("critical");
    expect(detectAuthFailureSpikes([{ service: "api", count: 10 }], [])).toEqual([]);
    expect(detectAuthFailureSpikes([{ service: "api", count: 90 }], [{ service: "api", count: 80 }])).toEqual([]);
  });
});

describe("findSecretExposures", () => {
  it("finds secrets, groups them per service and never returns the full value", () => {
    const key = "AKIAIOSFODNN7EXAMPLE";
    const found = findSecretExposures([
      { service: "api", message: `config loaded key=${key}` },
      { service: "api", message: `retry with ${key}` },
      { service: "web", message: "password=hunter2hunter2" },
      { service: "web", message: "all good" },
    ]);
    const aws = found.find((item) => item.kind === "AWS access key")!;
    expect(aws).toMatchObject({ service: "api", count: 2 });
    expect(JSON.stringify(found)).not.toContain(key);
    expect(JSON.stringify(found)).not.toContain("hunter2hunter2");
    expect(findSecretExposures([{ service: "web", message: "password=[REDACTED]" }])).toEqual([]);
    expect(found.some((item) => item.kind === "Password" && item.service === "web")).toBe(true);
  });
});
