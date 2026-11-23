import { NotFoundException } from "@nestjs/common";
import { afterEach, describe, expect, it, vi } from "vitest";
import { InvestigationChatService } from "./investigation-chat.service";
import type { ChatEvent } from "./investigation-chat.types";

const base = { id: "c1", object: "chat.completion.chunk", created: 1, model: "m" };

function sse(chunks: unknown[]): Response {
  const body = chunks.map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`).join("") + "data: [DONE]\n\n";
  return new Response(body, { status: 200, headers: { "content-type": "text/event-stream" } });
}

function toolCallResponse(name: string, args: Record<string, unknown>): Response {
  return sse([
    { ...base, choices: [{ index: 0, delta: { role: "assistant", tool_calls: [{ index: 0, id: "t1", type: "function", function: { name, arguments: JSON.stringify(args) } }] }, finish_reason: null }] },
    { ...base, choices: [{ index: 0, delta: {}, finish_reason: "tool_calls" }], usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 } },
  ]);
}

function textResponse(text: string): Response {
  return sse([
    { ...base, choices: [{ index: 0, delta: { role: "assistant", content: text }, finish_reason: null }] },
    { ...base, choices: [{ index: 0, delta: {}, finish_reason: "stop" }], usage: { prompt_tokens: 20, completion_tokens: 3, total_tokens: 23 } },
  ]);
}

interface StoredMessage {
  threadId: string;
  role: "user" | "assistant";
  content: string;
  steps: unknown[];
  status: "complete" | "failed" | "cancelled";
  totalTokens: number;
}

function fakeThreads() {
  const threads = new Map<string, { id: string; userId: string; title: string }>();
  const messages: StoredMessage[] = [];
  return {
    threads,
    messages,
    createThread: vi.fn(async (scope: { userId: string }, title: string) => {
      const id = `thread_${threads.size + 1}`;
      threads.set(id, { id, userId: scope.userId, title });
      return id;
    }),
    getThread: vi.fn(async (scope: { userId: string }, id: string) => {
      const thread = threads.get(id);
      return thread && thread.userId === scope.userId ? thread : undefined;
    }),
    recentMessages: vi.fn(async (_scope: unknown, id: string) => messages.filter((message) => message.threadId === id)),
    addMessage: vi.fn(async (_scope: unknown, message: Partial<StoredMessage> & { threadId: string; role: "user" | "assistant"; content: string }) => {
      messages.push({ steps: [], status: "complete", totalTokens: 0, ...message });
    }),
  };
}

const USER_SCOPE = { orgId: "org_1", projectId: "proj_1", userId: "user_1" };

function build(overrides: { project?: unknown; groups?: unknown } = {}) {
  const resolver = {
    resolve: vi.fn(async () => ({ source: "byok", providerId: "soonwhy", model: "m", baseUrl: "https://example.test/v1", apiKey: "k", credentialId: "cred" })),
    pricingFor: vi.fn((): { inputUsdPerMillion: number; outputUsdPerMillion: number } | null => ({ inputUsdPerMillion: 1, outputUsdPerMillion: 2 })),
  };
  const projects = { getProjectById: vi.fn(async () => ("project" in overrides ? overrides.project : { id: "proj_1" })) };
  const billing = { recordUsage: vi.fn(async () => undefined) };
  const threads = fakeThreads();
  const errors = { listGroups: vi.fn(async () => overrides.groups ?? { status: "empty", reason: "No errors in the last 24 hours.", data: null }), getGroup: vi.fn() };
  const service = new InvestigationChatService(resolver as never, projects as never, billing as never, threads as never, errors as never, {} as never, {} as never, {} as never);
  return { service, resolver, projects, billing, errors, threads };
}

async function collect(events: AsyncGenerator<ChatEvent>): Promise<ChatEvent[]> {
  const all: ChatEvent[] = [];
  for await (const event of events) all.push(event);
  return all;
}

afterEach(() => vi.restoreAllMocks());

describe("InvestigationChatService", () => {
  it("runs the tool loop, scoped to the caller's org and project, and meters usage", async () => {
    let call = 0;
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => (++call === 1 ? toolCallResponse("list_error_groups", { hours: 2 }) : textResponse("No errors found.")));
    const { service, errors, billing } = build();

    const session = await service.start(USER_SCOPE, { message: "anything failing?" }, new AbortController().signal);
    const events = await collect(session.events);

    expect(errors.listGroups).toHaveBeenCalledWith({ orgId: "org_1", projectId: "proj_1" }, expect.objectContaining({ hours: 2 }));
    expect(events.map((event) => event.type)).toEqual(["thread", "step", "step", "text", "done"]);
    expect(events[1]).toMatchObject({ type: "step", tool: "list_error_groups", status: "running" });
    expect(events[2]).toMatchObject({ type: "step", status: "complete", detail: "No errors in the last 24 hours." });
    expect(events[4]).toMatchObject({ type: "done", usage: { totalTokens: 38 } });
    expect(billing.recordUsage).toHaveBeenCalledWith(expect.objectContaining({ orgId: "org_1", projectId: "proj_1", metric: "ai_tokens_byok", quantity: 38, enforce: false }));
  });

  it("records the estimated cost of the turn with the model that answered", async () => {
    let call = 0;
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => (++call === 1 ? toolCallResponse("list_error_groups", {}) : textResponse("Done.")));
    const { service, billing, resolver } = build();

    const session = await service.start(USER_SCOPE, { message: "q" }, new AbortController().signal);
    await collect(session.events);

    expect(resolver.pricingFor).toHaveBeenCalledWith("soonwhy", "m");
    const recorded = (billing.recordUsage.mock.calls[0] as unknown as [{ metadata: Record<string, unknown> }])[0];
    expect(recorded.metadata).toMatchObject({ provider: "soonwhy", model: "m", credentialSource: "byok", inputTokens: 30, outputTokens: 8 });
    expect(recorded.metadata.costUsd).toBeCloseTo(0.000046, 9);
  });

  it("records the tokens but no cost when the model has no price", async () => {
    let call = 0;
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => (++call === 1 ? toolCallResponse("list_error_groups", {}) : textResponse("Done.")));
    const { service, billing, resolver } = build();
    resolver.pricingFor.mockReturnValue(null);

    const session = await service.start(USER_SCOPE, { message: "q" }, new AbortController().signal);
    await collect(session.events);

    expect(billing.recordUsage).toHaveBeenCalledWith(expect.objectContaining({ quantity: 38, metadata: expect.objectContaining({ costUsd: null }) }));
  });

  it("marks an unavailable tool result as failed, not complete", async () => {
    let call = 0;
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => (++call === 1 ? toolCallResponse("list_error_groups", {}) : textResponse("The query failed.")));
    const { service } = build({ groups: { status: "unavailable", reason: "x", data: null } });

    const session = await service.start(USER_SCOPE, { message: "errors?" }, new AbortController().signal);
    const events = await collect(session.events);

    expect(events.find((event) => event.type === "step" && event.status !== "running")).toMatchObject({ status: "failed" });
  });

  it("refuses a project outside the organization before calling the model", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    const { service, resolver } = build({ project: undefined });

    await expect(service.start({ ...USER_SCOPE, projectId: "other" }, { message: "hi" }, new AbortController().signal)).rejects.toBeInstanceOf(NotFoundException);
    expect(resolver.resolve).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reports a provider failure generically without leaking its message", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ error: { message: "secret-key-sk-123 invalid" } }), { status: 401 }));
    const { service, billing } = build();
    const written: string[] = [];
    const capture = (chunk: unknown) => {
      written.push(String(chunk));
      return true;
    };
    vi.spyOn(process.stdout, "write").mockImplementation(capture);
    vi.spyOn(process.stderr, "write").mockImplementation(capture);

    const session = await service.start(USER_SCOPE, { message: "hi" }, new AbortController().signal);
    const events = await collect(session.events);
    const last = events[events.length - 1];
    expect(written.join("")).not.toContain("sk-123");
    expect(written.join("")).not.toContain("example.test");

    expect(last?.type).toBe("error");
    expect(JSON.stringify(events)).not.toContain("sk-123");
    expect(billing.recordUsage).not.toHaveBeenCalled();
  });

  it("saves both sides of the turn, with steps and token usage", async () => {
    let call = 0;
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => (++call === 1 ? toolCallResponse("list_error_groups", {}) : textResponse("All clear.")));
    const { service, threads } = build();

    const session = await service.start(USER_SCOPE, { message: "anything failing?" }, new AbortController().signal);
    await collect(session.events);

    expect(threads.threads.get(session.threadId)).toMatchObject({ title: "anything failing?", userId: "user_1" });
    expect(threads.messages.map((message) => message.role)).toEqual(["user", "assistant"]);
    expect(threads.messages[1]).toMatchObject({ content: "All clear.", status: "complete", totalTokens: 38 });
    expect(threads.messages[1]?.steps).toHaveLength(1);
  });

  it("continues a thread using history from the database, not from the client", async () => {
    const bodies: string[] = [];
    vi.spyOn(globalThis, "fetch").mockImplementation(async (_url, init) => {
      bodies.push(String(init?.body));
      return textResponse("Same cause.");
    });
    const { service, threads } = build();
    threads.threads.set("thread_9", { id: "thread_9", userId: "user_1", title: "t" });
    threads.messages.push(
      { threadId: "thread_9", role: "user", content: "first question", steps: [], status: "complete", totalTokens: 0 },
      { threadId: "thread_9", role: "assistant", content: "first answer", steps: [], status: "complete", totalTokens: 5 },
      { threadId: "thread_9", role: "assistant", content: "half-written", steps: [], status: "failed", totalTokens: 0 },
    );

    const session = await service.start(USER_SCOPE, { message: "and now?", threadId: "thread_9" }, new AbortController().signal);
    await collect(session.events);

    expect(bodies[0]).toContain("first question");
    expect(bodies[0]).toContain("first answer");
    expect(bodies[0]).not.toContain("half-written");
    expect(bodies[0]).toContain("and now?");
  });

  it("refuses another user's thread before calling the model", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    const { service, threads } = build();
    threads.threads.set("thread_x", { id: "thread_x", userId: "someone_else", title: "private" });

    await expect(service.start(USER_SCOPE, { message: "hi", threadId: "thread_x" }, new AbortController().signal)).rejects.toBeInstanceOf(NotFoundException);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(threads.messages).toHaveLength(0);
  });

  it("records a failed turn so the conversation shows what happened", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 400 }));
    const { service, threads } = build();

    const session = await service.start(USER_SCOPE, { message: "hi" }, new AbortController().signal);
    await collect(session.events);

    expect(threads.messages[1]).toMatchObject({ role: "assistant", status: "failed" });
  });

  it("records a stopped turn as cancelled", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => new Promise<Response>(() => undefined));
    const { service, threads } = build();
    const controller = new AbortController();

    const session = await service.start(USER_SCOPE, { message: "hi" }, controller.signal);
    const pending = collect(session.events);
    setTimeout(() => controller.abort(), 200);
    const events = await pending;

    expect(events[events.length - 1]).toMatchObject({ type: "error", message: "Investigation stopped." });
    expect(threads.messages[1]).toMatchObject({ role: "assistant", status: "cancelled" });
  });
});
