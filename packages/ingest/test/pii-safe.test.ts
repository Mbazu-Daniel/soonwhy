import { describe, expect, it, vi } from "vitest";

vi.mock("@soonwhy/shared", () => ({
  encryptPii: () => {
    throw new Error("Unknown cipher");
  },
  encryptPiiInText: () => {
    throw new Error("Unknown cipher");
  },
}));

import { encryptOrRedact, encryptTextOrRedact } from "../src/parse/pii-safe";

describe("PII encryption on a runtime without the cipher", () => {
  it("redacts instead of throwing or storing plaintext", () => {
    expect(encryptOrRedact("jane@example.com")).toBe("[REDACTED]");
    expect(encryptTextOrRedact("mail jane@example.com")).toBe("[REDACTED]");
  });
});
