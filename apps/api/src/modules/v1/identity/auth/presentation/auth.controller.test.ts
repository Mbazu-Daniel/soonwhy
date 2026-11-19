import { BadRequestException, NotFoundException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  github: true,
  google: false,
  oidc: null as { id: string; name: string } | null,
  api: {
    signInSocial: vi.fn(),
    signUpEmail: vi.fn(),
    signInEmail: vi.fn(),
    signOut: vi.fn(),
    getSession: vi.fn(),
    deleteUser: vi.fn(),
    getInvitation: vi.fn(),
    acceptInvitation: vi.fn(),
  },
  audit: vi.fn(),
  findInvitation: vi.fn(),
}));

vi.mock("../../../../../common/config/better-auth.config", () => ({
  auth: { api: state.api },
  get githubEnabled() {
    return state.github;
  },
  get googleEnabled() {
    return state.google;
  },
  get oidcProvider() {
    return state.oidc;
  },
}));
vi.mock("../../../../../common/audit-logs", () => ({ recordAuditEvent: state.audit }));
vi.mock("../../../../../common/db/find-invitation-by-public-id", () => ({ findInvitationByPublicId: state.findInvitation }));

import { AuthController } from "./auth.controller";

const REQUEST = { ip: "203.0.113.9", headers: { "user-agent": "vitest" } } as never;

function response() {
  return { setHeader: vi.fn(), redirect: vi.fn() };
}

function redirectResult(cookies: string[], url: string | undefined) {
  const headers = new Headers();
  for (const cookie of cookies) headers.append("set-cookie", cookie);
  return { headers, response: url ? { url } : undefined };
}

describe("AuthController", () => {
  const controller = new AuthController();

  beforeEach(() => {
    vi.clearAllMocks();
    state.github = true;
    state.google = false;
    state.oidc = null;
    delete process.env.FRONTEND_URL;
  });

  it("reports which sign in methods are configured", () => {
    state.oidc = { id: "okta", name: "Okta" };
    expect(controller.getProviders()).toEqual({ emailAndPassword: true, google: false, github: true, oidc: { id: "okta", name: "Okta" } });
  });

  describe("social sign in", () => {
    it("rejects a provider it does not support", async () => {
      await expect(controller.socialSignIn("twitter", undefined, response() as never)).rejects.toBeInstanceOf(BadRequestException);
      expect(state.api.signInSocial).not.toHaveBeenCalled();
    });

    it("rejects a supported provider that is not configured", async () => {
      await expect(controller.socialSignIn("google", undefined, response() as never)).rejects.toThrow("google authentication is not configured");
      expect(state.api.signInSocial).not.toHaveBeenCalled();
    });

    it("forwards the cookies and redirects to the provider", async () => {
      process.env.FRONTEND_URL = "https://app.example.com";
      state.api.signInSocial.mockResolvedValue(redirectResult(["state=abc; Path=/", "nonce=xyz; Path=/"], "https://github.com/login"));
      const res = response();
      await controller.socialSignIn("github", "https://app.example.com/after", res as never);
      expect(state.api.signInSocial).toHaveBeenCalledWith({
        body: { provider: "github", callbackURL: "https://app.example.com/after" },
        returnHeaders: true,
      });
      expect(res.setHeader).toHaveBeenCalledWith("Set-Cookie", ["state=abc; Path=/", "nonce=xyz; Path=/"]);
      expect(res.redirect).toHaveBeenCalledWith("https://github.com/login");
    });

    it("replaces a callback on a foreign origin with the frontend", async () => {
      process.env.FRONTEND_URL = "https://app.example.com";
      state.api.signInSocial.mockResolvedValue(redirectResult([], "https://github.com/login"));
      await controller.socialSignIn("github", "https://evil.example/steal", response() as never);
      expect(state.api.signInSocial).toHaveBeenCalledWith(expect.objectContaining({ body: expect.objectContaining({ callbackURL: "https://app.example.com" }) }));
    });

    it("returns to the frontend when no callback is given", async () => {
      process.env.FRONTEND_URL = "https://app.soonwhy.test";
      state.api.signInSocial.mockResolvedValue(redirectResult([], "https://github.com/login"));
      const res = response();
      await controller.socialSignIn("github", undefined, res as never);
      expect(state.api.signInSocial).toHaveBeenCalledWith(expect.objectContaining({ body: expect.objectContaining({ callbackURL: "https://app.soonwhy.test" }) }));
      expect(res.setHeader).not.toHaveBeenCalled();
    });

    it("fails when the provider gives no redirect url", async () => {
      state.api.signInSocial.mockResolvedValue(redirectResult([], undefined));
      const res = response();
      await expect(controller.socialSignIn("github", undefined, res as never)).rejects.toThrow("Unable to start social authentication");
      expect(res.redirect).not.toHaveBeenCalled();
    });
  });

  describe("single sign on", () => {
    it("is refused when no identity provider is configured", async () => {
      await expect(controller.ssoSignIn(undefined, response() as never)).rejects.toThrow("Single sign-on is not configured");
    });

    it("starts sign in with the configured provider", async () => {
      process.env.FRONTEND_URL = "https://app.example.com";
      state.oidc = { id: "okta", name: "Okta" };
      state.api.signInSocial.mockResolvedValue(redirectResult([], "https://okta.example.com/authorize"));
      const res = response();
      await controller.ssoSignIn("https://app.example.com/home", res as never);
      expect(state.api.signInSocial).toHaveBeenCalledWith(expect.objectContaining({ body: { provider: "okta", callbackURL: "https://app.example.com/home" } }));
      expect(res.redirect).toHaveBeenCalledWith("https://okta.example.com/authorize");
    });
  });

  it("signs a user up with a name taken from the email and audits it", async () => {
    state.api.signUpEmail.mockResolvedValue({ user: { id: "u1" } });
    const result = await controller.signUp({ email: "ada.lovelace@example.com", password: "correct horse" } as never, REQUEST);
    expect(result).toEqual({ user: { id: "u1" } });
    expect(state.api.signUpEmail).toHaveBeenCalledWith({ body: { email: "ada.lovelace@example.com", password: "correct horse", name: "ada.lovelace" } });
    expect(state.audit).toHaveBeenCalledWith({ userId: "u1", action: "user.signUp", ipAddress: "203.0.113.9", userAgent: "vitest" });
  });

  it("does not audit a sign up that the auth provider refused", async () => {
    state.api.signUpEmail.mockRejectedValue(new Error("email already used"));
    await expect(controller.signUp({ email: "a@example.com", password: "pw" } as never, REQUEST)).rejects.toThrow("email already used");
    expect(state.audit).not.toHaveBeenCalled();
  });

  it("signs a user in and audits it", async () => {
    state.api.signInEmail.mockResolvedValue({ user: { id: "u1" } });
    await controller.signIn({ email: "a@example.com", password: "pw" } as never, REQUEST);
    expect(state.api.signInEmail).toHaveBeenCalledWith({ body: { email: "a@example.com", password: "pw" } });
    expect(state.audit).toHaveBeenCalledWith(expect.objectContaining({ userId: "u1", action: "user.signIn" }));
  });

  it("does not audit a failed sign in", async () => {
    state.api.signInEmail.mockRejectedValue(new Error("invalid credentials"));
    await expect(controller.signIn({ email: "a@example.com", password: "bad" } as never, REQUEST)).rejects.toThrow("invalid credentials");
    expect(state.audit).not.toHaveBeenCalled();
  });

  it("passes only the authorization and cookie headers to the auth provider", async () => {
    state.api.getSession.mockResolvedValue({ user: { id: "u1" } });
    state.api.signOut.mockResolvedValue({ success: true });
    await controller.signOut({ authorization: "Bearer t", cookie: "s=1", host: "evil.example.com", "x-forwarded-for": "1.2.3.4" }, REQUEST);
    expect(state.api.getSession).toHaveBeenCalledWith({ headers: { authorization: "Bearer t", cookie: "s=1" } });
    expect(state.api.signOut).toHaveBeenCalledWith({ headers: { authorization: "Bearer t", cookie: "s=1" } });
    expect(state.audit).toHaveBeenCalledWith(expect.objectContaining({ userId: "u1", action: "user.signOut" }));
  });

  it("reads the session from the forwarded headers only", async () => {
    state.api.getSession.mockResolvedValue(null);
    await expect(controller.getSession({ cookie: "s=1", "x-org-id": "o" })).resolves.toBeNull();
    expect(state.api.getSession).toHaveBeenCalledWith({ headers: { cookie: "s=1" } });
  });

  it("deletes the account with the password and audits who was deleted", async () => {
    state.api.getSession.mockResolvedValue({ user: { id: "u1", email: "a@example.com" } });
    state.api.deleteUser.mockResolvedValue({ success: true });
    await controller.deleteAccount({ password: "pw" }, { authorization: "Bearer t" }, REQUEST);
    expect(state.api.deleteUser).toHaveBeenCalledWith({ body: { password: "pw" }, headers: { authorization: "Bearer t" } });
    expect(state.audit).toHaveBeenCalledWith(expect.objectContaining({ action: "user.delete", metadata: { userId: "u1", email: "a@example.com" } }));
  });

  describe("invitations", () => {
    it("reports an unknown invitation as not found", async () => {
      state.findInvitation.mockResolvedValue(undefined);
      await expect(controller.getInvitation("nope", {})).rejects.toBeInstanceOf(NotFoundException);
      await expect(controller.acceptInvitation({ invitationId: "nope" }, {}, REQUEST)).rejects.toBeInstanceOf(NotFoundException);
      expect(state.api.getInvitation).not.toHaveBeenCalled();
      expect(state.api.acceptInvitation).not.toHaveBeenCalled();
    });

    it("looks an invitation up by its internal id, not the public one", async () => {
      state.findInvitation.mockResolvedValue({ id: "inv-internal", organizationId: "org-1" });
      state.api.getInvitation.mockResolvedValue({ id: "inv-internal" });
      await controller.getInvitation("pub-1", { authorization: "Bearer t" });
      expect(state.api.getInvitation).toHaveBeenCalledWith({ headers: { authorization: "Bearer t" }, query: { id: "inv-internal" } });
    });

    it("accepts an invitation by its internal id and audits with the public id", async () => {
      state.findInvitation.mockResolvedValue({ id: "inv-internal", organizationId: "org-1" });
      state.api.acceptInvitation.mockResolvedValue({ member: { userId: "u2" }, invitation: { organizationId: "org-1" } });
      await controller.acceptInvitation({ invitationId: "pub-1" }, { authorization: "Bearer t" }, REQUEST);
      expect(state.api.acceptInvitation).toHaveBeenCalledWith({ headers: { authorization: "Bearer t" }, body: { invitationId: "inv-internal" } });
      expect(state.audit).toHaveBeenCalledWith({
        userId: "u2",
        organizationId: "org-1",
        action: "invitation.accept",
        ipAddress: "203.0.113.9",
        userAgent: "vitest",
        metadata: { invitationId: "pub-1" },
      });
    });
  });
});
