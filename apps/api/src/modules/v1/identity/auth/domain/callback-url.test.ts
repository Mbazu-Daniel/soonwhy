import { afterEach, describe, expect, it } from "vitest";
import { safeCallbackUrl } from "./callback-url";

describe("safeCallbackUrl", () => {
  afterEach(() => {
    delete process.env.FRONTEND_URL;
  });

  it("keeps same-origin and relative targets", () => {
    process.env.FRONTEND_URL = "https://app.example.com";
    expect(safeCallbackUrl("https://app.example.com/dash")).toBe("https://app.example.com/dash");
    expect(safeCallbackUrl("/dash")).toBe("https://app.example.com/dash");
  });

  it("falls back for foreign, protocol-relative and malformed targets", () => {
    process.env.FRONTEND_URL = "https://app.example.com";
    for (const bad of ["https://evil.example", "//evil.example", "/\\evil.example", "javascript:alert(1)", "not a url"]) {
      expect(safeCallbackUrl(bad)).toBe("https://app.example.com");
    }
  });
});
