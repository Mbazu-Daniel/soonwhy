import { afterEach, describe, expect, it, vi } from "vitest";
import { OsvClient } from "./osv.client";

const reply = (body: unknown, ok = true, status = 200) => ({ ok, status, json: async () => body }) as Response;

describe("OsvClient", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("sends packages in batches of 1000 and maps answers back to packages", async () => {
    const fetchMock = vi.fn().mockImplementation(async (_url: string, init: RequestInit) => {
      const queries = JSON.parse(String(init.body)).queries as Array<{ package: { name: string } }>;
      return reply({ results: queries.map((query) => (query.package.name === "p1500" ? { vulns: [{ id: "GHSA-1" }] } : {})) });
    });
    vi.stubGlobal("fetch", fetchMock);
    const packages = Array.from({ length: 1600 }, (_, index) => ({ name: `p${index}`, version: "1.0.0" }));
    const matches = await new OsvClient().queryBatch("npm", packages);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(matches).toEqual([{ pkg: { name: "p1500", version: "1.0.0" }, advisoryId: "GHSA-1" }]);
  });

  it("fails instead of reporting a clean scan when the answer is incomplete or an error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply({ results: [] })));
    await expect(new OsvClient().queryBatch("npm", [{ name: "a", version: "1" }])).rejects.toThrow("incomplete");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply({}, false, 503)));
    await expect(new OsvClient().queryBatch("npm", [{ name: "a", version: "1" }])).rejects.toThrow("503");
  });

  it("loads advisory details by id", async () => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async (url: string) => reply({ id: url.split("/").pop() })));
    const found = await new OsvClient().advisories(["A", "B", "C"]);
    expect([...found.keys()].sort()).toEqual(["A", "B", "C"]);
  });
});
