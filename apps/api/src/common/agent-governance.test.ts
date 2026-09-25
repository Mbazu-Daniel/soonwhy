import { describe, expect, it, vi } from 'vitest';
import { AgentGovernance, type AgentToolAuditEvent } from './agent-governance';
import type { AgentAccessPolicy } from './db/schema/agent-governance';

const policy: AgentAccessPolicy = {
  orgId: 'org-1',
  userId: 'user-1',
  allowedTools: ['get-investigation', 'get-traces'],
  maxRequestsPerMinute: 10,
  maxTokensPerInvestigation: 1000,
  maxCostUsdPerInvestigation: 0.5,
  redactSensitiveData: true,
};

describe('AgentGovernance', () => {
  const governance = new AgentGovernance();

  it('rejects cross-tenant policy use', () => {
    expect(() => governance.authorizeTool(policy, { orgId: 'org-2', userId: 'user-1' }, 'get-traces')).toThrow('does not belong');
  });

  it('rejects user-scoped policy use by another user', () => {
    expect(() => governance.authorizeTool(policy, { orgId: 'org-1', userId: 'user-2' }, 'get-traces')).toThrow('not authorized for the requested user');
  });

  it('rejects unauthorized tools', () => {
    expect(() => governance.authorizeTool(policy, { orgId: 'org-1', userId: 'user-1' }, 'write-database')).toThrow('Agent tool is not authorized');
  });

  it('enforces request, token and cost budgets', () => {
    expect(() => governance.enforceBudget(policy, { requests: 11, tokens: 0, costUsd: 0 })).toThrow('Agent request rate limit exceeded');
    expect(() => governance.enforceBudget(policy, { requests: 1, tokens: 1001, costUsd: 0 })).toThrow('Agent token budget exceeded');
    expect(() => governance.enforceBudget(policy, { requests: 1, tokens: 1, costUsd: 0.51 })).toThrow('Agent cost budget exceeded');
  });

  it('fails closed when authorization audit fails', async () => {
    const executor = vi.fn(async () => ({ result: 'ok', tokens: 1, costUsd: 0.01 }));
    const audit = vi.fn(async (_event: AgentToolAuditEvent) => { throw new Error('audit unavailable'); });
    await expect(governance.execute(policy, {
      tool: { name: 'get-traces', readOnly: true, parseArgs: (value) => value as Record<string, unknown>, execute: executor },
      args: {},
      context: { orgId: 'org-1', userId: 'user-1' },
      usage: { requests: 0, tokens: 0, costUsd: 0 },
    }, audit)).rejects.toThrow('audit unavailable');
    expect(executor).not.toHaveBeenCalled();
  });

  it('rejects a non-read-only tool even when it is allowlisted', async () => {
    const audit = vi.fn(async () => undefined);
    await expect(governance.execute(policy, {
      tool: { name: 'get-traces', readOnly: false as true, parseArgs: (value) => value, execute: async () => ({ result: 'should-not-run', tokens: 0, costUsd: 0 }) },
      args: {},
      context: { orgId: 'org-1', userId: 'user-1' },
      usage: { requests: 0, tokens: 0, costUsd: 0 },
    }, audit)).rejects.toThrow('not read-only');
  });

  it('audits and executes an authorized read-only tool within budget', async () => {
    const events: AgentToolAuditEvent[] = [];
    const result = await governance.execute(policy, {
      tool: { name: 'get-traces', readOnly: true, parseArgs: (value) => value as { serviceName: string }, execute: async () => ({ result: ['trace-1'], tokens: 20, costUsd: 0.02 }) },
      args: { serviceName: 'api' },
      context: { orgId: 'org-1', userId: 'user-1', investigationId: 'inv-1' },
      usage: { requests: 0, tokens: 10, costUsd: 0.1 },
    }, async (event) => { events.push(event); });
    expect(result).toEqual(['trace-1']);
    expect(events.map((event) => event.eventType)).toEqual(['tool_authorized', 'tool_completed']);
  });

  it('redacts nested sensitive values', () => {
    const output = governance.redactSensitiveValue({ authorization: 'Bearer abc123', nested: { password: 'hunter2', visible: 'ok' }, list: [{ token: 'secret-token' }] }, true);
    expect(output).toEqual({ authorization: '[REDACTED]', nested: { password: '[REDACTED]', visible: 'ok' }, list: [{ token: '[REDACTED]' }] });
  });

  it('redacts common credential fields', () => {
    const input = 'authorization: Bearer abc123 cookie: session=secret token=abc password=hunter2';
    const output = governance.redactSensitiveData(input, true);
    expect(output).not.toContain('abc123');
    expect(output).not.toContain('hunter2');
    expect(output).toContain('[REDACTED]');
  });

  it('can disable redaction explicitly', () => {
    const input = 'token=abc123';
    expect(governance.redactSensitiveData(input, false)).toBe(input);
  });
});
