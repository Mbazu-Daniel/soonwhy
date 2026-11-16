import { AlertCircle, CheckCircle2, Loader2, MessageSquarePlus, Sparkles, Square, Trash2 } from 'lucide-react';
import { useRef, useState, type FormEvent } from 'react';
import { Link } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '~/components/ui/button';
import { Card, CardContent } from '~/components/ui/card';
import { Input } from '~/components/ui/input';
import { ProviderSwitch } from '~/components/ai/provider-switch';
import { api, apiProblem } from '~/lib/api';
import { AI_NOT_CONFIGURED, EMPTY_CHAT_STATE, applyEvent, readChatStream, toolLabel, turnsAfter } from '~/lib/investigation-chat';
import type { ChatState, ChatStep, ChatTurn, ThreadDetail, ThreadSummary } from '~/lib/investigation-chat.types';

interface InvestigationPanelProps {
  projectId: string;
  organizationSlug: string;
  suggestion: string;
}

function Steps({ steps }: { steps: ChatStep[] }) {
  if (steps.length === 0) return null;
  return (
    <ul className="space-y-1 text-xs text-muted-foreground">
      {steps.map((step) => (
        <li key={step.id} className="flex items-center gap-2">
          {step.status === 'running' ? <Loader2 className="h-3 w-3 animate-spin" /> : step.status === 'failed' ? <AlertCircle className="h-3 w-3 text-[#8A1C13]" /> : <CheckCircle2 className="h-3 w-3" />}
          <span>{toolLabel(step.tool)}</span>
          {step.detail && <span className="italic">{step.detail}</span>}
        </li>
      ))}
    </ul>
  );
}

function Turn({ turn }: { turn: ChatTurn }) {
  if (turn.role === 'user') return <p className="rounded-lg bg-muted px-3 py-2 text-sm">{turn.content}</p>;
  return (
    <div className="space-y-2">
      <Steps steps={turn.steps} />
      {turn.content && <p className="whitespace-pre-wrap break-words text-sm leading-6">{turn.content}</p>}
      {turn.status === 'failed' && <p className="text-xs text-[#8A1C13]">This answer could not be completed.</p>}
      {turn.status === 'cancelled' && <p className="text-xs text-muted-foreground">Stopped.</p>}
    </div>
  );
}

export function InvestigationPanel({ projectId, organizationSlug, suggestion }: InvestigationPanelProps) {
  const queryClient = useQueryClient();
  const [credentialId, setCredentialId] = useState('');
  const [question, setQuestion] = useState(suggestion);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [live, setLive] = useState<ChatState | null>(null);
  const [running, setRunning] = useState(false);
  const [notConfigured, setNotConfigured] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const controller = useRef<AbortController | null>(null);
  const threadsKey = ['chat-threads', projectId];

  const threads = useQuery({
    queryKey: threadsKey,
    queryFn: () => api.get<{ data: ThreadSummary[] }>(`/projects/${projectId}/ai/threads`),
  });

  function reset() {
    controller.current?.abort();
    setThreadId(null);
    setTurns([]);
    setLive(null);
    setStartError(null);
    setNotConfigured(false);
    setQuestion(suggestion);
  }

  async function open(id: string) {
    controller.current?.abort();
    setLive(null);
    setStartError(null);
    try {
      const detail = await api.get<ThreadDetail>(`/projects/${projectId}/ai/threads/${encodeURIComponent(id)}`);
      setThreadId(detail.id);
      setTurns(detail.messages);
      setQuestion('');
    } catch {
      setStartError('Could not open that conversation.');
    }
  }

  async function remove(id: string) {
    await api.delete(`/projects/${projectId}/ai/threads/${encodeURIComponent(id)}`);
    if (id === threadId) reset();
    void queryClient.invalidateQueries({ queryKey: threadsKey });
  }

  async function ask(event: FormEvent) {
    event.preventDefault();
    const message = question.trim();
    if (!message || running) return;
    controller.current = new AbortController();
    setRunning(true);
    setNotConfigured(false);
    setStartError(null);
    setQuestion('');
    let state = EMPTY_CHAT_STATE;
    setLive(state);
    try {
      const response = await api.stream(`/projects/${projectId}/ai/investigate`, { message, ...(threadId ? { threadId } : {}), ...(credentialId ? { credentialId } : {}) }, controller.current.signal);
      for await (const chunk of readChatStream(response)) {
        state = applyEvent(state, chunk);
        setLive(state);
      }
      if (!state.done) state = { ...state, done: true, error: state.error ?? 'Investigation stopped.' };
    } catch (error) {
      const problem = apiProblem(error);
      if (controller.current?.signal.aborted) state = { ...state, done: true, error: 'Investigation stopped.' };
      else if (problem.code === AI_NOT_CONFIGURED) {
        setNotConfigured(true);
        setQuestion(message);
        setLive(null);
        setRunning(false);
        return;
      } else {
        setStartError(problem.detail ?? 'Could not start the investigation.');
        setQuestion(message);
        setLive(null);
        setRunning(false);
        return;
      }
    }
    if (state.threadId) setThreadId(state.threadId);
    setTurns((current) => turnsAfter(current, message, state));
    setLive(null);
    setRunning(false);
    void queryClient.invalidateQueries({ queryKey: threadsKey });
  }

  const previous = threads.data?.data ?? [];

  return (
    <Card className="border-border shadow-none">
      <CardContent className="space-y-4 p-5">
        <div className="flex items-center justify-between gap-2">
          <p className="flex items-center gap-2 text-sm font-medium"><Sparkles className="h-4 w-4" />Ask a follow-up question</p>
          {(turns.length > 0 || threadId) && (
            <Button type="button" size="sm" variant="ghost" onClick={reset}><MessageSquarePlus className="mr-1 h-3.5 w-3.5" />New conversation</Button>
          )}
        </div>

        {turns.length === 0 && !live && previous.length > 0 && (
          <ul className="divide-y divide-border rounded-lg border border-border text-xs">
            {previous.slice(0, 5).map((thread) => (
              <li key={thread.id} className="flex items-center justify-between gap-2 px-3 py-2">
                <button type="button" className="min-w-0 flex-1 truncate text-left hover:underline" onClick={() => void open(thread.id)}>{thread.title}</button>
                <span className="shrink-0 text-muted-foreground">{new Date(thread.updatedAt).toLocaleDateString()}</span>
                <button type="button" aria-label={`Delete ${thread.title}`} className="shrink-0 text-muted-foreground hover:text-[#8A1C13]" onClick={() => void remove(thread.id)}><Trash2 className="h-3.5 w-3.5" /></button>
              </li>
            ))}
          </ul>
        )}

        {(turns.length > 0 || live) && (
          <div className="max-h-[28rem] space-y-3 overflow-auto">
            {turns.map((turn) => <Turn key={turn.id} turn={turn} />)}
            {live && (
              <div className="space-y-2">
                <Steps steps={live.steps} />
                {live.text && <p className="whitespace-pre-wrap break-words text-sm leading-6">{live.text}</p>}
                {running && !live.text && live.steps.length === 0 && <p className="text-xs text-muted-foreground">Starting…</p>}
              </div>
            )}
          </div>
        )}

        <form onSubmit={(event) => void ask(event)} className="flex gap-2">
          <ProviderSwitch value={credentialId} onChange={setCredentialId} className="max-w-[11rem]" />
          <Input value={question} onChange={(event) => setQuestion(event.target.value)} maxLength={2000} aria-label="Question" placeholder={turns.length > 0 ? 'Ask a follow-up…' : undefined} />
          {running ? (
            <Button type="button" variant="outline" onClick={() => controller.current?.abort()}><Square className="mr-1 h-3.5 w-3.5" />Stop</Button>
          ) : (
            <Button type="submit" disabled={!question.trim()}>Ask</Button>
          )}
        </form>

        {notConfigured && (
          <p className="text-sm text-muted-foreground">
            No AI provider is configured for this organization.{' '}
            <Link to="/$organizationSlug/ai" params={{ organizationSlug }} className="font-medium text-foreground underline">Set one up</Link>.
          </p>
        )}
        {startError && <p role="alert" className="text-sm text-[#8A1C13]">{startError}</p>}
      </CardContent>
    </Card>
  );
}
