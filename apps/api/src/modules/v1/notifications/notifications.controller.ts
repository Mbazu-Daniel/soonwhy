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
import {
  CurrentOrg,
  OrgContext,
} from "../../../common/decorators/current-org.decorator";
import { TenantGuard } from "../../../common/middleware/tenant-context.guard";
import { WebhookEndpointType } from "../../../common/db/schema";
import { NotificationService } from "./notification.service";
import { SlackService } from "./slack.service";
import { CreateNotificationChannelDto } from "./dto/create-notification-channel.dto";
import {
  CreateAlertRuleDto,
  UpdateAlertRuleDto,
} from "./dto/create-alert-rule.dto";
import { CreateWebhookEndpointDto } from "./dto/create-webhook-endpoint.dto";
import { z } from "zod";

const DispatchAlertDto = z.object({
  incidentId: z.string(),
  severity: z.enum(["critical", "high", "medium", "low"]),
  title: z.string(),
  body: z.string(),
  htmlBody: z.string().optional(),
});

const SlackConnectDto = z.object({
  code: z.string(),
});

const AssignOwnerDto = z.object({
  ownerId: z.string(),
  ownerName: z.string(),
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
    @Body() body: unknown,
  ) {
    const input = CreateNotificationChannelDto.parse(body);
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
    @Body() body: unknown,
  ) {
    const input = CreateNotificationChannelDto.partial().parse(body);
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
    @Body() body: unknown,
  ) {
    const input = CreateAlertRuleDto.parse(body);
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
    @Body() body: unknown,
  ) {
    const input = UpdateAlertRuleDto.parse(body);
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
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
  ) {
    const paging = z
      .object({
        limit: z.coerce.number().int().min(1).max(100).default(50),
        offset: z.coerce.number().int().min(0).default(0),
      })
      .parse({ limit, offset });
    return this.service.listNotificationLogs(org.orgId, projectId, paging);
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
    @Body() body: unknown,
  ) {
    const input = CreateWebhookEndpointDto.parse(body);
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
    @Body() body: unknown,
  ) {
    const input = CreateWebhookEndpointDto.partial().parse(body);
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
  dispatchAlert(
    @CurrentOrg() org: OrgContext,
    @Param("projectId") projectId: string,
    @Body() body: unknown,
  ) {
    const input = DispatchAlertDto.parse(body);
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
  async slackOAuthCallback(@Body() body: unknown) {
    const input = SlackConnectDto.parse(body);
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
    @Body() body: unknown,
  ) {
    const input = AssignOwnerDto.parse(body);
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
}
