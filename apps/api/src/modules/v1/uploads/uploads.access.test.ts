import { describe, expect, it } from "vitest";
import {
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import {
  assertSizeAndType,
  resolveUploadTarget,
  type MemberLookup,
} from "./uploads.access";

const ADMIN = { userId: "u_admin", role: "admin" };
const OWNER = { userId: "u_owner", role: "owner" };
const MEMBER = { userId: "u_member", role: "member" };

const lookup = (
  byId: Record<string, { id: string; userId: string } | null>,
  byUser: Record<string, { id: string; userId: string } | null> = {},
): MemberLookup => ({
  findById: async (id) => byId[id] ?? null,
  findByUser: async (id) => byUser[id] ?? null,
});

describe("resolveUploadTarget", () => {
  it("organization_logo requires owner or admin", async () => {
    await expect(
      resolveUploadTarget("organization_logo", "org_1", MEMBER, undefined, lookup({})),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(
      await resolveUploadTarget("organization_logo", "org_1", ADMIN, undefined, lookup({})),
    ).toBe("org_1");
    expect(
      await resolveUploadTarget("organization_logo", "org_1", OWNER, undefined, lookup({})),
    ).toBe("org_1");
  });

  it("user_avatar only allows the actor themselves", async () => {
    expect(
      await resolveUploadTarget("user_avatar", "org_1", MEMBER, undefined, lookup({})),
    ).toBe("u_member");
    expect(
      await resolveUploadTarget("user_avatar", "org_1", MEMBER, "u_member", lookup({})),
    ).toBe("u_member");
    await expect(
      resolveUploadTarget("user_avatar", "org_1", MEMBER, "u_else", lookup({})),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("member_avatar resolves the actor's own membership by default", async () => {
    const own = { id: "m_self", userId: "u_member" };
    expect(
      await resolveUploadTarget("member_avatar", "org_1", MEMBER, undefined, lookup({}, { u_member: own })),
    ).toBe("m_self");
  });

  it("member_avatar allows the member themselves but rejects other members as plain member", async () => {
    const target = { id: "m_target", userId: "u_target" };
    expect(
      await resolveUploadTarget("member_avatar", "org_1", { userId: "u_target", role: "member" }, "m_target", lookup({ m_target: target })),
    ).toBe("m_target");
    await expect(
      resolveUploadTarget("member_avatar", "org_1", MEMBER, "m_target", lookup({ m_target: target })),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("member_avatar allows admins and owners to set another member's avatar", async () => {
    const target = { id: "m_target", userId: "u_target" };
    expect(
      await resolveUploadTarget("member_avatar", "org_1", ADMIN, "m_target", lookup({ m_target: target })),
    ).toBe("m_target");
    expect(
      await resolveUploadTarget("member_avatar", "org_1", OWNER, "m_target", lookup({ m_target: target })),
    ).toBe("m_target");
  });

  it("member_avatar throws NotFound when the target is missing", async () => {
    await expect(
      resolveUploadTarget("member_avatar", "org_1", ADMIN, "m_missing", lookup({})),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe("assertSizeAndType", () => {
  it("passes when the object matches the declaration", () => {
    expect(
      assertSizeAndType(
        { sizeBytes: 123, mimeType: "image/png" },
        { sizeBytes: 123, contentType: "image/png" },
      ),
    ).toBeNull();
  });

  it("rejects a size mismatch", () => {
    expect(
      assertSizeAndType(
        { sizeBytes: 123, mimeType: "image/png" },
        { sizeBytes: 99, contentType: "image/png" },
      ),
    ).toMatch(/size/);
  });

  it("rejects a content-type mismatch", () => {
    expect(
      assertSizeAndType(
        { sizeBytes: null, mimeType: "image/png" },
        { sizeBytes: 123, contentType: "image/webp" },
      ),
    ).toMatch(/type/);
  });
});
