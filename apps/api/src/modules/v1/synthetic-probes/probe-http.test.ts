import { describe, expect, it } from "vitest";
import { pinnedLookup } from "./probe-http";
import dns from "node:dns";

function callLookup(hostname: string, all: boolean) {
  return new Promise<{ error: Error | null; address?: unknown; family?: number }>(
    (resolve) => {
      pinnedLookup(
        hostname,
        { all } as dns.LookupOptions,
        (error, address, family) => resolve({ error, address, family }),
      );
    },
  );
}

describe("pinnedLookup", () => {
  it("rejects literal private IPv4 addresses without DNS", async () => {
    const result = await callLookup("127.0.0.1", false);
    expect(result.error?.message).toMatch(/Private or reserved/);
  });

  it("rejects IPv6-mapped private addresses", async () => {
    const result = await callLookup("::ffff:10.0.0.5", false);
    expect(result.error?.message).toMatch(/Private or reserved/);
  });

  it("accepts literal public IPv4 addresses", async () => {
    const result = await callLookup("8.8.8.8", false);
    expect(result.error).toBeNull();
    expect(result.address).toBe("8.8.8.8");
  });

  it("rejects a hostname that resolves only to private addresses", async () => {
    const result = await callLookup("localhost", false);
    expect(result.error?.message).toMatch(/Private or reserved/);
  });

  it("returns the address list when all is requested", async () => {
    const result = await callLookup("8.8.8.8", true);
    expect(result.error).toBeNull();
    expect(Array.isArray(result.address)).toBe(true);
  });
});
