import { describe, expect, it } from "vitest";
import { groupByHost, hostNameOf } from "./host-groups";

const point = (host: unknown) => ({ metricName: "m", resource: { attributes: host === undefined ? {} : { "host.name": host } } });

describe("host groups", () => {
  it("reads the host name from the resource attributes", () => {
    expect(hostNameOf(point(" web-1 "))).toBe("web-1");
    expect(hostNameOf(point(undefined))).toBe("");
    expect(hostNameOf(point(42))).toBe("");
    expect(hostNameOf({ metricName: "m" })).toBe("");
  });

  it("groups points by host and keeps unnamed points together", () => {
    const groups = groupByHost([point("a"), point("b"), point("a"), point(undefined)]);
    expect([...groups.keys()]).toEqual(["a", "b", ""]);
    expect(groups.get("a")).toHaveLength(2);
    expect(groups.get("")).toHaveLength(1);
  });
});
