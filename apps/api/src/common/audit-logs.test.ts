import { describe, expect, it, vi, beforeEach } from "vitest";
import { recordAuditEvent, type AuditEventInput } from "./audit-logs";

const returning = vi.fn();
const values = vi.fn(() => ({ returning }));
vi.mock("./db", () => ({
  db: {
    insert: vi.fn(() => ({ values })),
  },
}));

describe("recordAuditEvent", () => {
  beforeEach(() => {
    returning.mockReset();
    values.mockReset();
  });

  it("records an audit event with user and organization context", async () => {
    returning.mockResolvedValue([{ id: "audit-1" }]);

    const input: AuditEventInput = {
      userId: "user-1",
      organizationId: "org-1",
      action: "user.signIn",
      ipAddress: "127.0.0.1",
      userAgent: "test-agent",
      metadata: { provider: "email" },
    };

    const event = await recordAuditEvent(input);

    expect(event).toEqual({ id: "audit-1" });
    expect(returning).toHaveBeenCalledTimes(1);
    expect(values).toHaveBeenCalledWith(input);
  });

  it("defaults optional fields to null", async () => {
    returning.mockResolvedValue([{ id: "audit-2" }]);

    await recordAuditEvent({ action: "organization.delete" });

    expect(values).toHaveBeenCalledWith({
      userId: null,
      organizationId: null,
      action: "organization.delete",
      ipAddress: null,
      userAgent: null,
      metadata: null,
    });
  });

  it("throws when the insert returns no row", async () => {
    returning.mockResolvedValue([]);

    await expect(recordAuditEvent({ action: "user.signOut" })).rejects.toThrow(
      "Failed to record audit event",
    );
  });
});
