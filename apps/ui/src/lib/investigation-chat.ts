import type { ChatEvent, ChatState, ChatTurn } from './investigation-chat.types';

export const AI_NOT_CONFIGURED = 'AI_NOT_CONFIGURED';

export const EMPTY_CHAT_STATE: ChatState = { threadId: null, steps: [], text: '', done: false, error: null };

const TOOL_LABELS: Record<string, string> = {
  list_findings: 'Checked detected findings',
  list_error_groups: 'Listed error groups',
  get_error_group: 'Read the error and its stack trace',
  list_logs: 'Searched logs',
  list_traces: 'Listed traces',
  get_trace: 'Inspected a trace',
  get_rca: 'Read the root cause analysis',
};

export function toolLabel(tool: string): string {
  return TOOL_LABELS[tool] ?? tool;
}

export function parseFrames(buffer: string): { events: ChatEvent[]; rest: string } {
  const parts = buffer.split('\n\n');
  const rest = parts.pop() ?? '';
  const events: ChatEvent[] = [];
  for (const part of parts) {
    const data = part.split('\n').filter((line) => line.startsWith('data:')).map((line) => line.slice(5).trim()).join('');
    if (!data) continue;
    try {
      events.push(JSON.parse(data) as ChatEvent);
    } catch {
      continue;
    }
  }
  return { events, rest };
}

export async function* readChatStream(response: Response): AsyncGenerator<ChatEvent> {
  if (!response.body) return;
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parsed = parseFrames(buffer);
    buffer = parsed.rest;
    yield* parsed.events;
  }
}

export function applyEvent(state: ChatState, event: ChatEvent): ChatState {
  if (event.type === 'thread') return { ...state, threadId: event.threadId };
  if (event.type === 'text') return { ...state, text: state.text + event.delta };
  if (event.type === 'done') return { ...state, done: true };
  if (event.type === 'error') return { ...state, done: true, error: event.message };
  const exists = state.steps.some((step) => step.id === event.id);
  const next = { id: event.id, tool: event.tool, status: event.status, detail: event.detail };
  return { ...state, steps: exists ? state.steps.map((step) => (step.id === event.id ? next : step)) : [...state.steps, next] };
}

export function turnsAfter(turns: ChatTurn[], question: string, live: ChatState): ChatTurn[] {
  const stamp = `${turns.length}`;
  return [
    ...turns,
    { id: `u${stamp}`, role: 'user', content: question, steps: [], status: 'complete' },
    {
      id: `a${stamp}`,
      role: 'assistant',
      content: live.text,
      steps: live.steps,
      status: live.error ? (live.error === 'Investigation stopped.' ? 'cancelled' : 'failed') : 'complete',
    },
  ];
}
