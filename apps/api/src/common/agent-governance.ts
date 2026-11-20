import type { AgentAccessPolicy } from "./db/schema/agent-governance";
import type { AgentBudget, AgentExecutionContext, AgentToolAuditEvent, AgentToolExecution } from "./agent-governance.types";

export class AgentGovernance {
  authorizeTool(
    policy: AgentAccessPolicy,
    context: AgentExecutionContext,
    toolName: string,
  ): void {
    if (policy.orgId !== context.orgId)
      throw new Error(
        "Agent policy does not belong to the requested organization",
      );
    if (policy.userId && policy.userId !== context.userId)
      throw new Error("Agent policy is not authorized for the requested user");
    if (!policy.allowedTools.includes(toolName))
      throw new Error(`Agent tool is not authorized: ${toolName}`);
  }

  enforceBudget(policy: AgentAccessPolicy, usage: AgentBudget): void {
    if (
      !Number.isSafeInteger(usage.requests) ||
      !Number.isSafeInteger(usage.tokens) ||
      !Number.isFinite(usage.costUsd) ||
      usage.requests < 0 ||
      usage.tokens < 0 ||
      usage.costUsd < 0
    ) {
      throw new Error("Agent usage must contain non-negative finite values");
    }
    if (usage.requests > policy.maxRequestsPerMinute)
      throw new Error("Agent request rate limit exceeded");
    if (usage.tokens > policy.maxTokensPerInvestigation)
      throw new Error("Agent token budget exceeded");
    if (usage.costUsd > policy.maxCostUsdPerInvestigation)
      throw new Error("Agent cost budget exceeded");
  }

  async execute<TArgs, TResult>(
    policy: AgentAccessPolicy,
    execution: AgentToolExecution<TArgs, TResult>,
    audit: (event: AgentToolAuditEvent) => Promise<void>,
  ): Promise<TResult> {
    const { tool, context } = execution;
    const toolName = tool.name;
    try {
      if (!tool.readOnly)
        throw new Error(`Agent tool is not read-only: ${toolName}`);
      this.authorizeTool(policy, context, toolName);
      await audit({
        eventType: "tool_authorized",
        status: "allowed",
        toolName,
        ...context,
      });
    } catch (error) {
      await audit({
        eventType: "tool_denied",
        status: "denied",
        toolName,
        ...context,
        metadata: {
          reason:
            error instanceof Error ? error.message : "authorization_failed",
        },
      });
      throw error;
    }
    const nextUsage = {
      requests: execution.usage.requests + 1,
      tokens: execution.usage.tokens,
      costUsd: execution.usage.costUsd,
    };
    try {
      this.enforceBudget(policy, nextUsage);
    } catch (error) {
      await audit({
        eventType: "tool_denied",
        status: "denied",
        toolName,
        ...context,
        metadata: {
          reason: error instanceof Error ? error.message : "budget_exceeded",
        },
      });
      throw error;
    }
    try {
      const args = tool.parseArgs(execution.args);
      const output = await tool.execute(args, context);
      const finalUsage = {
        requests: nextUsage.requests,
        tokens: nextUsage.tokens + output.tokens,
        costUsd: nextUsage.costUsd + output.costUsd,
      };
      this.enforceBudget(policy, finalUsage);
      await audit({
        eventType: "tool_completed",
        status: "completed",
        toolName,
        ...context,
        tokens: output.tokens,
        costUsd: output.costUsd,
      });
      return output.result;
    } catch (error) {
      await audit({
        eventType: "tool_failed",
        status: "failed",
        toolName,
        ...context,
        metadata: {
          reason:
            error instanceof Error ? error.message : "tool_execution_failed",
        },
      });
      throw error;
    }
  }

  redactSensitiveData(value: string, enabled: boolean): string {
    if (!enabled) return value;
    return value
      .replace(
        /(authorization|cookie|set-cookie|x-api-key)\s*[:=]\s*(?:Bearer\s+)?(?:"[^"]*"|'[^']*'|[^\s,;}]+)/gi,
        "$1: [REDACTED]",
      )
      .replace(
        /(password|passwd|secret|token|access_token|refresh_token)\s*[:=]\s*(?:"[^"]*"|'[^']*'|[^\s,;}]+)/gi,
        "$1: [REDACTED]",
      )
      .replace(/Bearer\s+[A-Za-z0-9._~+/-]+=*/gi, "Bearer [REDACTED]");
  }
  redactSensitiveValue(value: unknown, enabled: boolean): unknown {
    if (!enabled) return value;
    if (typeof value === "string") return this.redactSensitiveData(value, true);
    if (Array.isArray(value))
      return value.map((item) => this.redactSensitiveValue(item, true));
    if (!value || typeof value !== "object") return value;
    const sensitiveKeys =
      /^(authorization|cookie|set-cookie|x-api-key|password|passwd|secret|token|access_token|refresh_token)$/i;
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        sensitiveKeys.test(key)
          ? "[REDACTED]"
          : this.redactSensitiveValue(item, true),
      ]),
    );
  }
}
