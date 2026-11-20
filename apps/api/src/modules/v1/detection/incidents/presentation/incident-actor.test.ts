import { describe, expect, it, vi } from "vitest";
import { IncidentsController } from "./incidents.controller";
import { ErrorRegressionsController } from "../../error-regressions/presentation/error-regressions.controller";
import { actorLabel } from "../../../../../common/decorators/current-user.decorator";

const org = { orgId: "org", userRole: "member" };
const user = { id: "u1", email: "ada@example.com", name: "Ada", image: null, emailVerified: true };

describe("who acted comes from the session", () => {
  it("labels a user by name, then email", () => {
    expect(actorLabel(user)).toBe("Ada");
    expect(actorLabel({ name: " ", email: "ada@example.com" })).toBe("ada@example.com");
    expect(actorLabel(null)).toBe("unknown");
  });

  it("ignores a name sent in the body when acknowledging or resolving an incident", async () => {
    const service = { acknowledgeIncident: vi.fn(), resolveIncident: vi.fn() };
    const controller = new IncidentsController(service as never);
    await controller.acknowledgeIncident(org, "p", 1, user, { acknowledgedBy: "Someone Else", note: "n" } as never);
    await controller.resolveIncident(org, "p", 1, user, { resolvedBy: "Someone Else" } as never);
    expect(service.acknowledgeIncident).toHaveBeenCalledWith({ orgId: "org", projectId: "p" }, 1, "Ada", "n");
    expect(service.resolveIncident).toHaveBeenCalledWith({ orgId: "org", projectId: "p" }, 1, "Ada", undefined);
  });

  it("uses the session user when resolving an error regression", async () => {
    const service = { markAsResolved: vi.fn() };
    await new ErrorRegressionsController(service as never).markAsResolved(org, "p", "fp", user);
    expect(service.markAsResolved).toHaveBeenCalledWith("org", "p", "fp", "Ada");
  });
});
