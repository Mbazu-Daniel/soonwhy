import { describe, expect, it, vi } from "vitest";

vi.mock("./better-auth.config", () => ({ auth: {} }));

import { fullAuthUrl, isAuthCallbackPath } from "./auth-callback";

describe("isAuthCallbackPath", () => {
  it("allows only the provider callback routes", () => {
    expect(isAuthCallbackPath("/api/auth/callback/github?code=1&state=2")).toBe(true);
    expect(isAuthCallbackPath("/api/auth/callback/oidc?code=1")).toBe(true);
  });

  it("does not expose the other better-auth endpoints", () => {
    for (const url of ["/api/auth/sign-up/email", "/api/auth/sign-in/email", "/api/auth/get-session", "/api/auth/callback/", "/api/auth/oauth2/callback/oidc", "/api/auth/callback/../sign-out", "/api/auth//callback/x", undefined, ""]) {
      expect(isAuthCallbackPath(url), String(url)).toBe(false);
    }
  });
});

describe("fullAuthUrl", () => {
  it("restores the prefix when the router stripped it", () => {
    expect(fullAuthUrl("/callback/github?code=1")).toBe("/api/auth/callback/github?code=1");
    expect(fullAuthUrl("/api/auth/callback/github")).toBe("/api/auth/callback/github");
  });
});
