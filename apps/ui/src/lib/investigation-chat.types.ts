export type ChatStepStatus = 'running' | 'complete' | 'failed';

export type ChatEvent =
  | { type: 'thread'; threadId: string }
  | { type: 'step'; id: string; tool: string; status: ChatStepStatus; detail?: string }
  | { type: 'text'; delta: string }
  | { type: 'done'; usage: { inputTokens: number; outputTokens: number; totalTokens: number } }
  | { type: 'error'; message: string };

export interface ChatStep {
  id: string;
  tool: string;
  status: ChatStepStatus;
  detail?: string;
}

export interface ChatState {
  threadId: string | null;
  steps: ChatStep[];
  text: string;
  done: boolean;
  error: string | null;
}

export interface ChatTurn {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  steps: ChatStep[];
  status: 'complete' | 'failed' | 'cancelled';
}

export interface ThreadSummary {
  id: string;
  title: string;
  updatedAt: string;
}

export interface ThreadDetail {
  id: string;
  title: string;
  messages: ChatTurn[];
}
