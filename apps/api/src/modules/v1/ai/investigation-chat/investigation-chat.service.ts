import { Inject, Injectable, Logger, NotFoundException } from "@nestjs/common";
import type { CoreMessage } from "@mastra/core/llm";
import { maskPii } from "../../../../common/privacy/pii-masker";
import { generateId } from "../../../../common/db/generate-id";
import type { ChatMessageStatus } from "../../../../common/db/schema";
import { BillingService } from "../../billing/billing.service";
import { ErrorsInvestigation } from "../../investigation-tools/errors-investigation.service";
import { FindingsInvestigation } from "../../investigation-tools/findings-investigation.service";
import { RcaInvestigation } from "../../investigation-tools/rca-investigation.service";
import { TelemetryInvestigation } from "../../investigation-tools/telemetry-investigation.service";
import { ProjectsRepository } from "../../projects/projects.repository";
import { LlmProviderResolver } from "../llm-provider.resolver";
import { eventOf } from "./chat-chunks";
import { toModelHistory } from "./chat-history";
import { ChatThreadsRepository, type ThreadScope } from "./chat-threads.repository";
import { createInvestigationAgent } from "./investigation-chat.agent";
import {
  CHAT_MAX_HISTORY,
  CHAT_MAX_OUTPUT_TOKENS,
  CHAT_MAX_STEPS,
  CHAT_TIMEOUT_MS,
  CHAT_TITLE_CHARS,
  CHAT_USAGE_SOURCE,
} from "./investigation-chat.constants";
import { buildInvestigationTools } from "./investigation-chat.tools";
import type { ChatEvent, ChatRequest, ChatStep, ChatUsage } from "./investigation-chat.types";

export interface ChatSession {
  threadId: string;
  events: AsyncGenerator<ChatEvent>;
}

interface TurnRecord {
  text: string;
  steps: ChatStep[];
  status: ChatMessageStatus;
  totalTokens: number;
}

@Injectable()
export class InvestigationChatService {
  private readonly logger = new Logger(InvestigationChatService.name);

  constructor(
    @Inject(LlmProviderResolver) private readonly resolver: LlmProviderResolver,
    @Inject(ProjectsRepository) private readonly projects: ProjectsRepository,
    @Inject(BillingService) private readonly billing: BillingService,
    @Inject(ChatThreadsRepository) private readonly threads: ChatThreadsRepository,
    @Inject(ErrorsInvestigation) private readonly errors: ErrorsInvestigation,
    @Inject(TelemetryInvestigation) private readonly telemetry: TelemetryInvestigation,
    @Inject(FindingsInvestigation) private readonly findings: FindingsInvestigation,
    @Inject(RcaInvestigation) private readonly rca: RcaInvestigation,
  ) {}

  async start(scope: ThreadScope, request: ChatRequest, signal: AbortSignal): Promise<ChatSession> {
    const project = await this.projects.getProjectById(scope.projectId, scope.orgId);
    if (!project) throw new NotFoundException("Project not found");
    const model = await this.resolver.resolve(scope.orgId, request.credentialId);
    const { threadId, history } = await this.openThread(scope, request);
    await this.threads.addMessage({ threadId, role: "user", content: request.message });
    const tools = buildInvestigationTools(
      { orgId: scope.orgId, projectId: scope.projectId },
      { errors: this.errors, telemetry: this.telemetry, findings: this.findings, rca: this.rca },
    );
    const agent = createInvestigationAgent(model, tools);
    return { threadId, events: this.run(agent, scope, threadId, [...history, { role: "user", content: request.message }], signal) };
  }

  private async openThread(scope: ThreadScope, request: ChatRequest): Promise<{ threadId: string; history: CoreMessage[] }> {
    if (!request.threadId) {
      const threadId = await this.threads.createThread(scope, request.message.slice(0, CHAT_TITLE_CHARS));
      return { threadId, history: [] };
    }
    const thread = await this.threads.getThread(scope, request.threadId);
    if (!thread) throw new NotFoundException("Conversation not found");
    const rows = await this.threads.recentMessages(thread.id, CHAT_MAX_HISTORY);
    return { threadId: thread.id, history: toModelHistory(rows) };
  }

  private async *run(
    agent: ReturnType<typeof createInvestigationAgent>,
    scope: ThreadScope,
    threadId: string,
    messages: CoreMessage[],
    signal: AbortSignal,
  ): AsyncGenerator<ChatEvent> {
    const runId = generateId();
    const record: TurnRecord = { text: "", steps: [], status: "cancelled", totalTokens: 0 };
    const abortSignal = AbortSignal.any([signal, AbortSignal.timeout(CHAT_TIMEOUT_MS)]);
    try {
      yield { type: "thread", threadId };
      const output = await agent.stream(messages, {
        maxSteps: CHAT_MAX_STEPS,
        abortSignal,
        modelSettings: { maxOutputTokens: CHAT_MAX_OUTPUT_TOKENS, maxRetries: 0 },
      });
      for await (const chunk of output.fullStream) {
        abortSignal.throwIfAborted();
        if (chunk.type === "error") throw new Error("model error");
        const event = eventOf(chunk);
        if (!event) continue;
        this.remember(record, event);
        yield event;
      }
      if (!record.text) throw new Error("empty answer");
      const usage = await this.usageOf(output.usage);
      record.totalTokens = usage.totalTokens;
      record.status = "complete";
      await this.meter(scope, runId, usage);
      yield { type: "done", usage };
    } catch (error) {
      record.status = signal.aborted ? "cancelled" : "failed";
      this.logger.warn(`Investigation chat ${record.status}: ${error instanceof Error ? maskPii(error.message) : "unknown"}`);
      yield { type: "error", message: signal.aborted ? "Investigation stopped." : "The model could not complete this investigation. Try a narrower question." };
    } finally {
      await this.save(threadId, record);
    }
  }

  private remember(record: TurnRecord, event: ChatEvent): void {
    if (event.type === "text") record.text += event.delta;
    if (event.type !== "step") return;
    const { type: _type, ...step } = event;
    const index = record.steps.findIndex((existing) => existing.id === step.id);
    if (index === -1) record.steps.push(step);
    else record.steps[index] = step;
  }

  private async save(threadId: string, record: TurnRecord): Promise<void> {
    try {
      await this.threads.addMessage({
        threadId,
        role: "assistant",
        content: record.text,
        steps: record.steps,
        status: record.status,
        totalTokens: record.totalTokens,
      });
    } catch {
      this.logger.warn(`Chat turn could not be saved for thread ${threadId}`);
    }
  }

  private async usageOf(usage: PromiseLike<{ inputTokens?: number; outputTokens?: number; totalTokens?: number }>): Promise<ChatUsage> {
    const value = await usage;
    const inputTokens = value.inputTokens ?? 0;
    const outputTokens = value.outputTokens ?? 0;
    return { inputTokens, outputTokens, totalTokens: value.totalTokens ?? inputTokens + outputTokens };
  }

  private async meter(scope: ThreadScope, runId: string, usage: ChatUsage): Promise<void> {
    if (usage.totalTokens <= 0) return;
    try {
      await this.billing.recordUsage({
        orgId: scope.orgId,
        projectId: scope.projectId,
        metric: "ai_tokens_byok",
        quantity: usage.totalTokens,
        source: CHAT_USAGE_SOURCE,
        idempotencyKey: `${runId}:tokens`,
        enforce: false,
      });
    } catch {
      this.logger.warn(`Chat usage could not be recorded for run ${runId}`);
    }
  }
}
