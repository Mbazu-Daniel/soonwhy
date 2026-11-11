import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  NotFoundException,
} from "@nestjs/common";
import { Idempotent } from "@nestjs/idempotency";
import {
  CurrentOrg,
  OrgContext,
} from "../../../common/decorators/current-org.decorator";
import { TenantGuard } from "../../../common/middleware/tenant-context.guard";
import { WebhookEndpointType } from "../../../common/db/schema";
import { NotificationService } from "./notification.service";
import { SlackService } from "./slack.service";
import {
  CreateNotificationChannelDto,
  UpdateNotificationChannelDto,
  type CreateNotificationChannelInput,
  type UpdateNotificationChannelInput,
} from "./dto/create-notification-channel.dto";
import {
  CreateAlertRuleDto,
  UpdateAlertRuleDto,
  type CreateAlertRuleInput,
  type UpdateAlertRuleInput,
} from "./dto/create-alert-rule.dto";
import {
  CreateWebhookEndpointDto,
  UpdateWebhookEndpointDto,
  type CreateWebhookEndpointInput,
  type UpdateWebhookEndpointInput,
} from "./dto/create-webhook-endpoint.dto";
import {
  DispatchAlertDto,
  SlackConnectDto,
  AssignOwnerDto,
  type DispatchAlertInput,
  type SlackConnectInput,
  type AssignOwnerInput,
} from "./dto/notification-requests.dto";
import { z } from "zod";

const NotificationLogQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

@UseGuards(TenantGuard)
@Controller("projects/:projectId/notifications")
export class NotificationsController {
  constructor(
    private readonly service: NotificationService,
    private readonly slack: SlackService,
  ) {}

  @Get("channels")
  listChannels(
    @CurrentOrg() org: OrgContext,
    @Param("projectId") projectId: string,
  ) {
    return this.service.listChannels(org.orgId, projectId);
  }

  @Post("channels")
  createChannel(
    @CurrentOrg() org: OrgContext,
    @Param("projectId") projectId: string,
    @Body({ schema: CreateNotificationChannelDto })
    body: CreateNotificationChannelInput,
  ) {
    const input = body;
    return this.service.createChannel(org.orgId, projectId, {
      ...input,
      fromEmail: input.fromEmail ?? null,
      fromName: input.fromName ?? null,
      recipientEmails: input.recipientEmails ?? [],
      slackAccessToken: null,
      slackChannelId: input.slackChannelId ?? null,
      slackUserId: input.slackUserId ?? null,
      slackConnectedAt: null,
      webhookUrl: input.webhookUrl ?? null,
      webhookSecret: input.webhookSecret ?? null,
      webhookTypes: input.webhookTypes ?? [],
      isActive: true,
    });
  }

  @Put("channels/:channelId")
  updateChannel(
    @CurrentOrg() org: OrgContext,
    @Param("projectId") projectId: string,
    @Param("channelId") channelId: string,
    @Body({ schema: UpdateNotificationChannelDto })
    body: UpdateNotificationChannelInput,
  ) {
    const input = body;
    return this.service.updateChannel(
      org.orgId,
      projectId,
      channelId,
      input,
    );
  }

  @Delete("channels/:channelId")
  deleteChannel(
    @CurrentOrg() org: OrgContext,
    @Param("projectId") projectId: string,
    @Param("channelId") channelId: string,
  ) {
    return this.service.deleteChannel(org.orgId, projectId, channelId);
  }

  @Get("alert-rules")
  listAlertRules(
    @CurrentOrg() org: OrgContext,
    @Param("projectId") projectId: string,
  ) {
    return this.service.listAlertRules(org.orgId, projectId);
  }

  @Post("alert-rules")
  createAlertRule(
    @CurrentOrg() org: OrgContext,
    @Param("projectId") projectId: string,
    @Body({ schema: CreateAlertRuleDto }) body: CreateAlertRuleInput,
  ) {
    const input = body;
    return this.service.createAlertRule(org.orgId, projectId, {
      ...input,
      description: input.description ?? null,
      status: "active",
    });
  }

  @Put("alert-rules/:ruleId")
  updateAlertRule(
    @CurrentOrg() org: OrgContext,
    @Param("projectId") projectId: string,
    @Param("ruleId") ruleId: string,
    @Body({ schema: UpdateAlertRuleDto }) body: UpdateAlertRuleInput,
  ) {
    const input = body;
    return this.service.updateAlertRule(
      org.orgId,
      projectId,
      ruleId,
      input,
    );
  }

  @Delete("alert-rules/:ruleId")
  deleteAlertRule(
    @CurrentOrg() org: OrgContext,
    @Param("projectId") projectId: string,
    @Param("ruleId") ruleId: string,
  ) {
    return this.service.deleteAlertRule(org.orgId, projectId, ruleId);
  }

  @Get("logs")
  listNotificationLogs(
    @CurrentOrg() org: OrgContext,
    @Param("projectId") projectId: string,
    @Query({ schema: NotificationLogQuerySchema })
    query: z.output<typeof NotificationLogQuerySchema>,
  ) {
    return this.service.listNotificationLogs(org.orgId, projectId, query);
  }

  @Get("webhooks")
  listWebhookEndpoints(
    @CurrentOrg() org: OrgContext,
    @Param("projectId") projectId: string,
  ) {
    return this.service.listWebhookEndpoints(org.orgId, projectId);
  }

  @Post("webhooks")
  createWebhookEndpoint(
    @CurrentOrg() org: OrgContext,
    @Param("projectId") projectId: string,
    @Body({ schema: CreateWebhookEndpointDto })
    body: CreateWebhookEndpointInput,
  ) {
    const input = body;
    return this.service.createWebhookEndpoint(org.orgId, projectId, {
      ...input,
      secret: input.secret ?? null,
      isActive: true,
      types: input.types as WebhookEndpointType[],
    });
  }

  @Put("webhooks/:endpointId")
  updateWebhookEndpoint(
    @CurrentOrg() org: OrgContext,
    @Param("projectId") projectId: string,
    @Param("endpointId") endpointId: string,
    @Body({ schema: UpdateWebhookEndpointDto })
    body: UpdateWebhookEndpointInput,
  ) {
    const input = body;
    return this.service.updateWebhookEndpoint(
      org.orgId,
      projectId,
      endpointId,
      {
        ...input,
        secret: input.secret ?? null,
        types: input.types as WebhookEndpointType[] | undefined,
      },
    );
  }

  @Delete("webhooks/:endpointId")
  deleteWebhookEndpoint(
    @CurrentOrg() org: OrgContext,
    @Param("projectId") projectId: string,
    @Param("endpointId") endpointId: string,
  ) {
    return this.service.deleteWebhookEndpoint(org.orgId, projectId, endpointId);
  }

  @Post("dispatch")
  @Idempotent({
    ttl: 3600,
  })
  dispatchAlert(
    @CurrentOrg() org: OrgContext,
    @Param("projectId") projectId: string,
    @Body({ schema: DispatchAlertDto }) body: DispatchAlertInput,
  ) {
    const input = body;
    return this.service.dispatchAlert({
      orgId: org.orgId,
      projectId,
      incidentId: input.incidentId,
      severity: input.severity,
      title: input.title,
      body: input.body,
      htmlBody: input.htmlBody,
    });
  }

  @Get("slack/authorize-url")
  slackAuthorizeUrl(@Query("redirectUri") redirectUri?: string) {
    const clientId = process.env.SLACK_CLIENT_ID!;
    const uri = redirectUri ?? process.env.SLACK_REDIRECT_URI!;
    const scopes = process.env.SLACK_BOT_SCOPES!;
    return { url: this.slack.getAuthorizeUrl(clientId, uri, scopes) };
  }

  @Post("slack/oauth/callback")
  async slackOAuthCallback(
    @Body({ schema: SlackConnectDto }) body: SlackConnectInput,
  ) {
    const input = body;
    const clientId = process.env.SLACK_CLIENT_ID!;
    const clientSecret = process.env.SLACK_CLIENT_SECRET!;
    const redirectUri = process.env.SLACK_REDIRECT_URI!;

    const token = await this.slack.exchangeCode(
      clientId,
      clientSecret,
      input.code,
      redirectUri,
    );
    if (!token.ok || !token.access_token) {
      throw new NotFoundException(token.error || "Slack OAuth failed");
    }
    return {
      ok: true,
      accessToken: token.access_token,
      userId: token.user_id,
      teamId: token.team_id,
    };
  }

  @Get("incidents/:incidentId/timeline")
  listTimeline(
    @CurrentOrg() org: OrgContext,
    @Param("projectId") projectId: string,
    @Param("incidentId") incidentId: string,
  ) {
    return this.service.listTimelineEvents(org.orgId, projectId, incidentId);
  }

  @Post("incidents/:incidentId/owner")
  assignOwner(
    @CurrentOrg() org: OrgContext,
    @Param("projectId") projectId: string,
    @Param("incidentId") incidentId: string,
    @Body({ schema: AssignOwnerDto }) body: AssignOwnerInput,
  ) {
    const input = body;
    return this.service.assignOwner(
      org.orgId,
      projectId,
      incidentId,
      input.ownerId,
      input.ownerName,
    );
  }

  @Get("incidents/:incidentId/owner")
  getOwner(
    @CurrentOrg() org: OrgContext,
    @Param("projectId") projectId: string,
    @Param("incidentId") incidentId: string,
  ) {
    return this.service.getOwner(org.orgId, projectId, incidentId);
  }

  @Post("retry-failed")
  async retryFailedNotifications() {
    return this.service.retryFailedNotifications();
  }
}
