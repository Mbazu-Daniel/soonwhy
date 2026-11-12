import { describe, expect, it } from "vitest";
import { normalizeNextRoute } from "./normalize.js";

describe("normalizeNextRoute", () => {
  it("collapses UUID segments to :id", () => {
    expect(normalizeNextRoute("/users/018f3c2a-1234-7abc-8def-0123456789ab")).toBe(
      "/users/:id",
    );
  });

  it("collapses integer segments to :id", () => {
    expect(normalizeNextRoute("/users/42")).toBe("/users/:id");
  });

  it("collapses long hex segments to :id", () => {
    expect(normalizeNextRoute("/posts/66b1f0a8c2d4e5f6a7b8c9d0")).toBe(
      "/posts/:id",
    );
  });

  it("collapses ULID segments to :id", () => {
    expect(normalizeNextRoute("/items/01ARZ3NDEKTSV4RRFFQ69G5FAV")).toBe(
      "/items/:id",
    );
  });

  it("keeps semantic segments untouched", () => {
    expect(normalizeNextRoute("/docs/getting-started")).toBe(
      "/docs/getting-started",
    );
  });

  it("adds a leading slash when missing", () => {
    expect(normalizeNextRoute("users/42")).toBe("/users/:id");
  });

  it("returns root for the root path", () => {
    expect(normalizeNextRoute("/")).toBe("/");
  });

  it("caps route length at 256 characters", () => {
    expect(normalizeNextRoute(`/${"g".repeat(500)}`)).toHaveLength(256);
  });
});
