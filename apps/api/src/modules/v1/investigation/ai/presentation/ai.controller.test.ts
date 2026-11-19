import { describe, expect, it, vi } from "vitest";
import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { AiController, ChatSchema } from "./ai.controller";
import type { OrgContext } from "../../../../../common/decorators/current-org.decorator";

function harness(userRole: string) {
  const org: OrgContext = { orgId: "org_1", userRole };
  const service = {
    get: vi.fn().mockResolvedValue({ configured: false }),
    list: vi.fn().mockResolvedValue({ credentials: [] }),
    create: vi.fn().mockResolvedValue({ id: "cred_1" }),
    update: vi.fn().mockResolvedValue({ id: "cred_1" }),
    removeCredential: vi.fn().mockResolvedValue({ removed: true }),
    liveModels: vi.fn().mockResolvedValue({ source: "live", models: [] }),
    save: vi.fn().mockResolvedValue({ configured: true }),
    remove: vi.fn().mockResolvedValue({ configured: false }),
    testConnection: vi.fn().mockResolvedValue({ ok: true }),
    providers: vi.fn().mockResolvedValue({ providers: [] }),
    models: vi.fn().mockResolvedValue([]),
    usage: vi.fn().mockResolvedValue({}),
    chat: vi.fn().mockResolvedValue({ content: "ok" }),
  };
  const billing = { setOrgQuota: vi.fn().mockResolvedValue({ id: "quota_1" }) };
  return {
    org,
    service,
    billing,
    controller: new AiController(service, billing),
  };
}

const CREDENTIAL = {
  provider: "groq",
  model: "openai/gpt-oss-120b",
  apiKey: "a-key-that-is-long-enough",
};

describe("AiController", () => {
  it("lets any member read the AI configuration", async () => {
    const h = harness("member");

    await expect(h.controller.get(h.org)).resolves.toEqual({
      configured: false,
    });
    await h.controller.providers(h.org);
    await h.controller.usage(h.org);

    expect(h.service.get).toHaveBeenCalledWith("org_1", false);
    expect(h.service.usage).toHaveBeenCalledWith("org_1", "month");
  });

  it("passes the requested usage period to the service", async () => {
    const h = harness("admin");

    await h.controller.usage(h.org, "last_month");

    expect(h.service.usage).toHaveBeenCalledWith("org_1", "last_month");
  });

  it("rejects an unknown usage period before reading any data", () => {
    const h = harness("admin");

    expect(() => h.controller.usage(h.org, "decade")).toThrow(BadRequestException);
    expect(h.service.usage).not.toHaveBeenCalled();
  });

  it("refuses to let a member change AI settings", async () => {
    const h = harness("member");

    expect(() => h.controller.save(h.org, CREDENTIAL)).toThrow(
      ForbiddenException,
    );
    expect(() => h.controller.remove(h.org)).toThrow(ForbiddenException);
    expect(() => h.controller.test(h.org, {})).toThrow(ForbiddenException);
    expect(() =>
      h.controller.setQuota(h.org, { metric: "ai_tokens", limit: 100 }),
    ).toThrow(ForbiddenException);
    expect(h.service.save).not.toHaveBeenCalled();
    expect(h.billing.setOrgQuota).not.toHaveBeenCalled();
  });

  it("accepts an owner's credential and records the metric unit", async () => {
    const h = harness("owner");

    await h.controller.save(h.org, CREDENTIAL);
    await h.controller.setQuota(h.org, {
      metric: "rca_invocations",
      limit: null,
    });

    expect(h.service.save).toHaveBeenCalledWith("org_1", CREDENTIAL);
    expect(h.billing.setOrgQuota).toHaveBeenCalledWith({
      orgId: "org_1",
      metric: "rca_invocations",
      limit: null,
      unit: "invocations",
    });
  });

  it("tests the stored credential when the body is empty", async () => {
    const h = harness("admin");

    await h.controller.test(h.org, {});

    expect(h.service.testConnection).toHaveBeenCalledWith("org_1", undefined);
  });

  it("rejects a chat message it cannot bound", async () => {
    const h = harness("member");

    expect(() => ChatSchema.parse({ message: "  " })).toThrow();
    expect(() => ChatSchema.parse({ message: "x".repeat(8001) })).toThrow();
    await h.controller.chat(h.org, ChatSchema.parse({ message: "what broke?" }));
    expect(h.service.chat).toHaveBeenLastCalledWith("what broke?", "org_1");
  });

  it("lists models for one provider rather than the whole catalogue", async () => {
    const h = harness("member");

    await expect(h.controller.models(h.org, "Groq")).resolves.toEqual({
      models: [],
    });
    expect(h.service.models).toHaveBeenCalledWith("Groq");
  });

  describe("provider library", () => {
    it("lets any member list providers but only managers change them", async () => {
      const member = harness("member");

      await member.controller.credentials(member.org);
      expect(member.service.list).toHaveBeenCalledWith("org_1", false);
      expect(() => member.controller.createCredential(member.org, CREDENTIAL)).toThrow(ForbiddenException);
      expect(() => member.controller.updateCredential(member.org, "cred_1", { model: "m" })).toThrow(ForbiddenException);
      expect(() => member.controller.deleteCredential(member.org, "cred_1")).toThrow(ForbiddenException);
      expect(() => member.controller.testCredential(member.org, "cred_1")).toThrow(ForbiddenException);
      expect(() => member.controller.liveModels(member.org, { provider: "groq", apiKey: "k" })).toThrow(ForbiddenException);
      expect(member.service.create).not.toHaveBeenCalled();
    });

    it("scopes every change to the caller's organisation", async () => {
      const owner = harness("owner");

      await owner.controller.createCredential(owner.org, { ...CREDENTIAL, name: "Fast lane", isDefault: true });
      await owner.controller.updateCredential(owner.org, "cred_1", { model: "other", isDefault: true });
      await owner.controller.deleteCredential(owner.org, "cred_1");
      await owner.controller.testCredential(owner.org, "cred_1");
      await owner.controller.liveModels(owner.org, { credentialId: "cred_1" });

      expect(owner.service.create).toHaveBeenCalledWith("org_1", expect.objectContaining({ name: "Fast lane", isDefault: true }));
      expect(owner.service.update).toHaveBeenCalledWith("org_1", "cred_1", { model: "other", isDefault: true });
      expect(owner.service.removeCredential).toHaveBeenCalledWith("org_1", "cred_1");
      expect(owner.service.testConnection).toHaveBeenCalledWith("org_1", undefined, "cred_1");
      expect(owner.service.liveModels).toHaveBeenCalledWith("org_1", { credentialId: "cred_1" });
    });
  });
});
