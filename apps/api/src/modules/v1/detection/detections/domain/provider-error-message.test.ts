import { describe, expect, it } from "vitest";
import { providerMessageOf } from "./provider-error-message";

describe("providerMessageOf", () => {
  it("reads the message from the provider's parsed error data", () => {
    const error = Object.assign(new Error("Bad Request"), { data: { error: { message: "response_format is unavailable" } } });

    expect(providerMessageOf(error)).toBe("response_format is unavailable");
  });

  it("reads the message from a raw JSON response body", () => {
    const error = Object.assign(new Error("Bad Request"), { responseBody: '{"error":{"message":"model not found"}}' });

    expect(providerMessageOf(error)).toBe("model not found");
  });

  it("looks through a cause chain", () => {
    const error = Object.assign(new Error("outer"), { cause: { responseBody: '{"message":"inner problem"}' } });

    expect(providerMessageOf(error)).toBe("inner problem");
  });

  it("falls back to the error's own message", () => {
    expect(providerMessageOf(new Error("plain failure"))).toBe("plain failure");
    expect(providerMessageOf("nope")).toBeUndefined();
  });

  it("masks anything that looks like a key and truncates long text", () => {
    const secret = "sk-abcdefghijklmnopqrstuvwxyz0123456789";
    const out = providerMessageOf(new Error(`invalid key ${secret} ${"x ".repeat(300)}`));

    expect(out).not.toContain(secret);
    expect(out).toContain("invalid key …");
    expect(out!.length).toBeLessThanOrEqual(241);
  });
});
