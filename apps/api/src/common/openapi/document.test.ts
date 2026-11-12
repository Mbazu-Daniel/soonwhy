import { describe, expect, it } from "vitest";
import { apiDocument } from "./document";

const paths = () =>
  apiDocument.paths as unknown as Record<string, Record<string, { operationId?: string; responses: Record<string, unknown> }>>;

describe("openapi document (auth slice)", () => {
  it("contains exactly the auth surface", () => {
    expect(Object.keys(paths()).sort()).toEqual(
      [
        "/api/v1/auth/providers",
        "/api/v1/auth/session",
        "/api/v1/auth/sign-in",
        "/api/v1/auth/sign-out",
        "/api/v1/auth/sign-up",
        "/api/v1/auth/social/{provider}",
      ].sort(),
    );
  });

  it("gives every documented operation an operationId and a success response", () => {
    for (const [path, methods] of Object.entries(paths())) {
      for (const [method, operation] of Object.entries(methods)) {
        expect(operation.operationId, `${method.toUpperCase()} ${path}`).toBeTruthy();
        const codes = Object.keys(operation.responses);
        expect(
          codes.some((code) => code.startsWith("2") || code === "302"),
          `${method.toUpperCase()} ${path} has no successful response`,
        ).toBe(true);
      }
    }
  });

  it("registers the shared problem-detail and auth components", () => {
    const components = (apiDocument.components?.schemas ?? {}) as Record<string, unknown>;
    expect(Object.keys(components)).toEqual(
      expect.arrayContaining([
        "ProblemDetail",
        "AuthUser",
        "AuthSession",
        "AuthResult",
        "AuthProviders",
      ]),
    );
  });

  it("targets OpenAPI 3.1 with a bearer security scheme", () => {
    expect(apiDocument.openapi).toBe("3.1.0");
    const schemes = (apiDocument.components?.securitySchemes ?? {}) as Record<string, { scheme?: string }>;
    expect(schemes.bearerAuth?.scheme).toBe("bearer");
  });
});
