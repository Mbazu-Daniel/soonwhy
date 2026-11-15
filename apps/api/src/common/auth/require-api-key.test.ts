import { ForbiddenException, UnauthorizedException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { requireApiKey } from "./require-api-key";

const authenticator = (result: unknown) => ({ authenticate: vi.fn().mockResolvedValue(result) }) as never;

describe("requireApiKey", () => {
  it("returns the key", async () => {
    const key = { organizationId: "o", projectId: "p", scopes: [] };
    await expect(requireApiKey(authenticator({ ok: true, key }), "Bearer x")).resolves.toBe(key);
  });

  it("maps a missing or invalid key to 401 and a missing scope to 403", async () => {
    await expect(requireApiKey(authenticator({ ok: false, reason: "missing", message: "m" }), undefined)).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(requireApiKey(authenticator({ ok: false, reason: "invalid", message: "m" }), "Bearer x")).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(requireApiKey(authenticator({ ok: false, reason: "scope", message: "m" }), "Bearer x", { scope: "s" })).rejects.toBeInstanceOf(ForbiddenException);
  });
});
