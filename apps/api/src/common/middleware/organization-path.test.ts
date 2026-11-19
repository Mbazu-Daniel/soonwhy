import { describe, expect, it } from "vitest";
import { organizationIdFromUrl, projectIdFromUrl } from "./organization-path";

describe("organizationIdFromUrl", () => {
  it("reads the organization id from the route prefix", () => {
    expect(organizationIdFromUrl("/api/v1/organization/org_1/projects")).toBe(
      "org_1",
    );
  });

  it("decodes the organization id and ignores the query string", () => {
    expect(
      organizationIdFromUrl("/api/v1/organization/org%201/logs?projectId=p"),
    ).toBe("org 1");
  });

  it("ignores auth, marketing, health, and organization collection routes", () => {
    expect(organizationIdFromUrl("/api/v1/auth/session")).toBeUndefined();
    expect(organizationIdFromUrl("/api/v1/marketing/waitlist")).toBeUndefined();
    expect(organizationIdFromUrl("/api/v1/health/ready")).toBeUndefined();
    expect(organizationIdFromUrl("/api/v1/organizations")).toBeUndefined();
  });
});

describe("projectIdFromUrl", () => {
  it("reads the project id from the path or the query", () => {
    expect(projectIdFromUrl("/api/v1/organization/o/projects/p1/services")).toBe("p1");
    expect(projectIdFromUrl("/api/v1/organization/o/environments?projectId=p2")).toBe("p2");
  });

  it("returns nothing for collection routes", () => {
    expect(projectIdFromUrl("/api/v1/organization/o/projects")).toBeUndefined();
  });
});
