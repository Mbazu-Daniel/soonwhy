import { ConflictException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { TeamsService } from "./teams.service";

const input = { name: "Platform", slug: "platform" };

describe("TeamsService.create", () => {
  it("rejects a slug that is already taken", async () => {
    const repository = { findBySlug: vi.fn().mockResolvedValue({ id: "t1" }), create: vi.fn() };
    await expect(new TeamsService(repository as never).create("org", input)).rejects.toBeInstanceOf(ConflictException);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it("reports a conflict when a concurrent request took the slug between the check and the insert", async () => {
    const repository = { findBySlug: vi.fn().mockResolvedValue(undefined), create: vi.fn().mockResolvedValue(undefined) };
    await expect(new TeamsService(repository as never).create("org", input)).rejects.toBeInstanceOf(ConflictException);
  });

  it("returns the created team", async () => {
    const team = { id: "t1", ...input };
    const repository = { findBySlug: vi.fn().mockResolvedValue(undefined), create: vi.fn().mockResolvedValue(team) };
    await expect(new TeamsService(repository as never).create("org", input)).resolves.toBe(team);
  });
});
