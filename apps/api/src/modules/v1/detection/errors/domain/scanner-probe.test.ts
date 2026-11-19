import { describe, expect, it } from "vitest";
import { isScannerProbe } from "./scanner-probe";

const group = (errorMessage: string, errorType = "HTTP 404") => ({ errorMessage, errorType });

describe("isScannerProbe", () => {
  it.each([
    "GET /.git/HEAD 404",
    "GET /.env 404",
    "GET /.env.production 404",
    "GET /.git.bak/config 404",
    "GET /old/.git/HEAD 404",
    "GET /.hg/hgrc 404",
    "GET /.svn/wc.db 404",
    "GET /assets/index.js.map 404",
    "GET /pnpm-lock.yaml 404",
    "GET /vendor/ 404",
    "GET /node_modules/.package-lock.json 404",
    "GET /reconx-0a6875796177 404",
    "GET /sitemap.xml 404",
    "GET /.git-credentials 404",
  ])("flags %s", (message) => {
    expect(isScannerProbe(group(message))).toBe(true);
  });

  it.each([
    "GET /health 404",
    "GET /api/v1/requests/123 404",
    "GET /api/v1/users/me 404",
    "GET /api/v1/version 404",
  ])("keeps %s", (message) => {
    expect(isScannerProbe(group(message))).toBe(false);
  });

  it("never flags non-404 errors", () => {
    expect(isScannerProbe(group("GET /.env 500", "HTTP 500"))).toBe(false);
    expect(isScannerProbe(group("POST /api/v1/auth/sign-in/email 401", "HTTP 401"))).toBe(false);
  });
});
