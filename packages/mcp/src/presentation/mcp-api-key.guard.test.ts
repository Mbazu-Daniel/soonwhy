import { ForbiddenException, UnauthorizedException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { MCP_PRINCIPAL_KEY, MCP_READ_SCOPE } from "../domain/mcp.constants";
import { McpApiKeyGuard } from "./mcp-api-key.guard";

function build(outcome: Promise<unknown>) {
  const authenticate = vi.fn().mockReturnValue(outcome);
  const request: Record<string | symbol, unknown> = { headers: { authorization: "Bearer soonwhy_x" } };
  const context = { switchToHttp: () => ({ getRequest: () => request }) } as never;
  return { authenticate, request, context, guard: new McpApiKeyGuard({ authenticate }) };
}

describe("McpApiKeyGuard", () => {
  it("asks for the read scope and attaches the authenticated principal", async () => {
    const principal = { orgId: "o1", projectId: "p1", scopes: [MCP_READ_SCOPE] };
    const { guard, context, request, authenticate } = build(Promise.resolve(principal));
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(authenticate).toHaveBeenCalledWith("Bearer soonwhy_x", { scope: MCP_READ_SCOPE });
    expect(request[MCP_PRINCIPAL_KEY]).toEqual(principal);
  });

  it("rejects when the authenticator says the key is not valid", async () => {
    const { guard, context, request } = build(Promise.reject(new UnauthorizedException("Invalid API key")));
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(request[MCP_PRINCIPAL_KEY]).toBeUndefined();
  });

  it("rejects when the key lacks the read scope", async () => {
    const { guard, context, request } = build(Promise.reject(new ForbiddenException("needs scope")));
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(ForbiddenException);
    expect(request[MCP_PRINCIPAL_KEY]).toBeUndefined();
  });
});
