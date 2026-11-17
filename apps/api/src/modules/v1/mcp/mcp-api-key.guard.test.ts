import { ForbiddenException, UnauthorizedException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { McpApiKeyGuard } from "./mcp-api-key.guard";
import { MCP_PRINCIPAL_KEY, MCP_READ_SCOPE } from "./mcp.constants";

function build(result: unknown) {
  const authenticate = vi.fn().mockResolvedValue(result);
  const request: Record<string | symbol, unknown> = { headers: { authorization: "Bearer soonwhy_x" } };
  const context = { switchToHttp: () => ({ getRequest: () => request }) } as never;
  return { authenticate, request, context, guard: new McpApiKeyGuard({ authenticate } as never) };
}

describe("McpApiKeyGuard", () => {
  it("asks for the read scope and attaches the key's organization, project and scopes", async () => {
    const { guard, context, request, authenticate } = build({ ok: true, key: { organizationId: "o1", projectId: "p1", scopes: [MCP_READ_SCOPE], maxAttributeCount: 5 } });
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(authenticate).toHaveBeenCalledWith("Bearer soonwhy_x", { scope: MCP_READ_SCOPE });
    expect(request[MCP_PRINCIPAL_KEY]).toEqual({ orgId: "o1", projectId: "p1", scopes: [MCP_READ_SCOPE] });
  });

  it("rejects a key that is not valid", async () => {
    const { guard, context, request } = build({ ok: false, reason: "invalid", message: "Invalid API key" });
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(request[MCP_PRINCIPAL_KEY]).toBeUndefined();
  });

  it("rejects a key without the read scope", async () => {
    const { guard, context, request } = build({ ok: false, reason: "scope", message: "needs scope" });
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(ForbiddenException);
    expect(request[MCP_PRINCIPAL_KEY]).toBeUndefined();
  });
});
