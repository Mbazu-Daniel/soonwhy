import { NotFoundException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { SavedQueryDto } from "../domain/dto/saved-query.dto";

const returning = vi.fn();
const where = vi.fn(() => ({ returning, limit: vi.fn().mockResolvedValue([]) }));
vi.mock("../../../../../common/db", () => ({
  db: { delete: () => ({ where }), select: () => ({ from: () => ({ where }) }) },
}));

import { QueryCatalogService } from "./query-catalog.service";

describe("SavedQueryDto", () => {
  it("accepts a log view and trims the name", () => {
    const parsed = SavedQueryDto.parse({ name: "  Errors  ", dataType: "logs", query: { q: "level:error" } });
    expect(parsed.name).toBe("Errors");
  });

  it("rejects empty names, unknown data types and oversized queries", () => {
    expect(SavedQueryDto.safeParse({ name: " ", dataType: "logs", query: {} }).success).toBe(false);
    expect(SavedQueryDto.safeParse({ name: "x", dataType: "other", query: {} }).success).toBe(false);
    expect(SavedQueryDto.safeParse({ name: "x", dataType: "logs", query: { q: "a".repeat(9000) } }).success).toBe(false);
  });
});

describe("QueryCatalogService ownership", () => {
  it("does not delete a saved query that belongs to another project", async () => {
    returning.mockResolvedValueOnce([]);
    await expect(new QueryCatalogService().deleteSavedQuery("org", "project", "id")).rejects.toBeInstanceOf(NotFoundException);
    expect(where).toHaveBeenCalledTimes(1);
  });

  it("reports a missing saved query", async () => {
    await expect(new QueryCatalogService().getSavedQuery("org", "project", "id")).rejects.toBeInstanceOf(NotFoundException);
  });
});
