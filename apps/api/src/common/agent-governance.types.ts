export type AgentBudget = {
  requests: number;
  tokens: number;
  costUsd: number;
};

export type AgentExecutionContext = {
  orgId: string;
  userId?: string;
  investigationId?: string;
};

export type AgentToolAuditEvent = {
  eventType:
    | "tool_authorized"
    | "tool_denied"
    | "tool_completed"
    | "tool_failed";
  status: "allowed" | "denied" | "completed" | "failed";
  toolName: string;
  orgId: string;
  userId?: string;
  investigationId?: string;
  tokens?: number;
  costUsd?: number;
  metadata?: Record<string, string | number | boolean | null>;
};

export type AgentToolDefinition<TArgs, TResult> = {
  name: string;
  readOnly: true;
  parseArgs: (value: unknown) => TArgs;
  execute: (
    args: TArgs,
    context: AgentExecutionContext,
  ) => Promise<{ result: TResult; tokens: number; costUsd: number }>;
};

export type AgentToolExecution<TArgs, TResult> = {
  tool: AgentToolDefinition<TArgs, TResult>;
  args: unknown;
  context: AgentExecutionContext;
  usage: AgentBudget;
};
