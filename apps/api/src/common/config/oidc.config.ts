import type { OidcSettings } from "./oidc.config.types";

const DISCOVERY_PATH = "/.well-known/openid-configuration";
const PROVIDER_ID = /^[a-z0-9][a-z0-9-]{0,31}$/;

export function discoveryUrlFor(issuer: string): string {
  const trimmed = issuer.trim().replace(/\/+$/, "");
  return trimmed.endsWith(DISCOVERY_PATH) ? trimmed : `${trimmed}${DISCOVERY_PATH}`;
}

export function oidcSettings(env: NodeJS.ProcessEnv = process.env): OidcSettings | null {
  const issuer = env.OIDC_ISSUER?.trim();
  const clientId = env.OIDC_CLIENT_ID?.trim();
  const clientSecret = env.OIDC_CLIENT_SECRET?.trim();
  if (!issuer || !clientId || !clientSecret) return null;

  const providerId = (env.OIDC_PROVIDER_ID?.trim() || "oidc").toLowerCase();
  if (!PROVIDER_ID.test(providerId)) {
    throw new Error("OIDC_PROVIDER_ID must be lowercase letters, digits and dashes, up to 32 characters");
  }
  const url = new URL(discoveryUrlFor(issuer));
  if (url.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(url.hostname)) {
    throw new Error("OIDC_ISSUER must use https");
  }

  const scopes = (env.OIDC_SCOPES ?? "openid email profile").split(/[\s,]+/).filter(Boolean);
  return {
    providerId,
    name: env.OIDC_DISPLAY_NAME?.trim() || "Single sign-on",
    discoveryUrl: url.toString(),
    clientId,
    clientSecret,
    scopes: scopes.includes("openid") ? scopes : ["openid", ...scopes],
  };
}

export const oidc = oidcSettings();
