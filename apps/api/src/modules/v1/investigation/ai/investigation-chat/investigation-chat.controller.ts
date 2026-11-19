import { Body, Controller, Delete, Get, HttpCode, NotFoundException, Param, Post, Res, UnauthorizedException, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import type { z } from "zod";
import { CurrentOrg, type OrgContext } from "../../../../../common/decorators/current-org.decorator";
import { CurrentUser } from "../../../../../common/decorators/current-user.decorator";
import { type AuthUser } from "../../../../../common/decorators/current-user.decorator.types";
import { TenantGuard } from "../../../../../common/middleware/tenant-context.guard";
import { ChatThreadsRepository } from "./chat-threads.repository";
import { type ThreadScope } from "./chat-threads.repository.types";
import { CHAT_THREAD_LIST_LIMIT, CHAT_THREAD_MESSAGES_LIMIT } from "./investigation-chat.constants";
import { InvestigationChatSchema } from "./investigation-chat.schema";
import { InvestigationChatService } from "./investigation-chat.service";
import type { ChatEvent } from "./investigation-chat.types";

function frame(event: ChatEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

function scopeOf(org: OrgContext, projectId: string, user: AuthUser | null): ThreadScope {
  if (!user) throw new UnauthorizedException("Sign in to use the investigator");
  return { orgId: org.orgId, projectId, userId: user.id };
}

@UseGuards(TenantGuard)
@Controller("projects/:projectId/ai")
export class InvestigationChatController {
  constructor(
    private readonly chat: InvestigationChatService,
    private readonly threads: ChatThreadsRepository,
  ) {}

  @Post("investigate")
  async investigate(
    @CurrentOrg() org: OrgContext,
    @CurrentUser() user: AuthUser | null,
    @Param("projectId") projectId: string,
    @Body({ schema: InvestigationChatSchema }) body: z.output<typeof InvestigationChatSchema>,
    @Res() response: Response,
  ): Promise<void> {
    const controller = new AbortController();
    response.on("close", () => controller.abort());
    const session = await this.chat.start(scopeOf(org, projectId, user), body, controller.signal);
    response.status(200).set({
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    });
    response.flushHeaders();
    for await (const event of session.events) {
      if (response.writableEnded) break;
      response.write(frame(event));
    }
    response.end();
  }

  @Get("threads")
  async list(@CurrentOrg() org: OrgContext, @CurrentUser() user: AuthUser | null, @Param("projectId") projectId: string) {
    return { data: await this.threads.listThreads(scopeOf(org, projectId, user), CHAT_THREAD_LIST_LIMIT) };
  }

  @Get("threads/:threadId")
  async get(
    @CurrentOrg() org: OrgContext,
    @CurrentUser() user: AuthUser | null,
    @Param("projectId") projectId: string,
    @Param("threadId") threadId: string,
  ) {
    const thread = await this.threads.getThread(scopeOf(org, projectId, user), threadId);
    if (!thread) throw new NotFoundException("Conversation not found");
    const messages = await this.threads.listMessages(thread.id, CHAT_THREAD_MESSAGES_LIMIT);
    return {
      id: thread.id,
      title: thread.title,
      messages: messages.map((message) => ({
        id: message.id,
        role: message.role,
        content: message.content,
        steps: message.steps,
        status: message.status,
        createdAt: message.createdAt,
      })),
    };
  }

  @Delete("threads/:threadId")
  @HttpCode(204)
  async remove(
    @CurrentOrg() org: OrgContext,
    @CurrentUser() user: AuthUser | null,
    @Param("projectId") projectId: string,
    @Param("threadId") threadId: string,
  ): Promise<void> {
    const removed = await this.threads.deleteThread(scopeOf(org, projectId, user), threadId);
    if (!removed) throw new NotFoundException("Conversation not found");
  }
}
