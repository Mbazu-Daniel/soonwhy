export type ChatStepStatus = "running" | "complete" | "failed";

export interface ChatStep {
  id: string;
  tool: string;
  status: ChatStepStatus;
  detail?: string;
}

export type ChatEvent =
  | { type: "thread"; threadId: string }
  | ({ type: "step" } & ChatStep)
  | { type: "text"; delta: string }
  | { type: "done"; usage: ChatUsage }
  | { type: "error"; message: string };

export interface ChatUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface ChatRequest {
  message: string;
  threadId?: string;
  credentialId?: string;
}
