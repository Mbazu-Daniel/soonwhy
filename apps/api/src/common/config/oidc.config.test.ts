import { describe, expect, it } from "vitest";
import { discoveryUrlFor, oidcSettings } from "./oidc.config";

const base = { OIDC_ISSUER: "https://idp.example.com/", OIDC_CLIENT_ID: "id", OIDC_CLIENT_SECRET: "secret" };

describe("oidcSettings", () => {
  it("is off unless issuer, client id and secret are all set", () => {
    expect(oidcSettings({})).toBeNull();
    expect(oidcSettings({ ...base, OIDC_CLIENT_SECRET: "" })).toBeNull();
    expect(oidcSettings({ ...base, OIDC_ISSUER: undefined })).toBeNull();
  });

  it("builds the discovery url and defaults", () => {
    expect(oidcSettings(base)).toMatchObject({
      providerId: "oidc",
      name: "Single sign-on",
      discoveryUrl: "https://idp.example.com/.well-known/openid-configuration",
      scopes: ["openid", "email", "profile"],
    });
  });

  it("does not double the discovery path", () => {
    expect(discoveryUrlFor("https://idp.example.com/.well-known/openid-configuration")).toBe(
      "https://idp.example.com/.well-known/openid-configuration",
    );
  });

  it("always requests the openid scope", () => {
    expect(oidcSettings({ ...base, OIDC_SCOPES: "email,groups" })?.scopes).toEqual(["openid", "email", "groups"]);
  });

  it("requires https except for localhost", () => {
    expect(() => oidcSettings({ ...base, OIDC_ISSUER: "http://idp.example.com" })).toThrow("https");
    expect(oidcSettings({ ...base, OIDC_ISSUER: "http://localhost:9000" })).not.toBeNull();
  });

  it("rejects an unsafe provider id", () => {
    expect(() => oidcSettings({ ...base, OIDC_PROVIDER_ID: "Bad Id/../" })).toThrow("OIDC_PROVIDER_ID");
  });
});
