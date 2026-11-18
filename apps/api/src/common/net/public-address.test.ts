import { describe, expect, it } from "vitest";
import { assertPublicHttpUrl, assertPublicHttpUrlSyntax, UnsafeOutboundUrlError } from "./public-address";

describe("assertPublicHttpUrlSyntax", () => {
  it("accepts ordinary public URLs", () => {
    expect(assertPublicHttpUrlSyntax("https://hooks.example.com/path?a=1").hostname).toBe("hooks.example.com");
    expect(assertPublicHttpUrlSyntax("http://93.184.216.34/x").hostname).toBe("93.184.216.34");
  });

  it.each([
    "http://169.254.169.254/latest/meta-data",
    "http://127.0.0.1:7280/api/v1/indexes",
    "http://10.0.0.5/",
    "http://192.168.1.1/",
    "http://[::1]/",
    "http://localhost:4222/",
    "http://svc.localhost/",
    "http://quickwit.internal/",
    "file:///etc/passwd",
    "ftp://example.com/",
    "https://user:pass@example.com/",
    "not a url",
  ])("rejects %s", (url) => {
    expect(() => assertPublicHttpUrlSyntax(url)).toThrow(UnsafeOutboundUrlError);
  });
});

describe("assertPublicHttpUrl", () => {
  it("rejects a private IP literal without a DNS lookup", async () => {
    await expect(assertPublicHttpUrl("http://172.16.0.9/")).rejects.toThrow(UnsafeOutboundUrlError);
  });
});
