import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Inject,
  Param,
  Post,
  Put,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import {
  CurrentOrg,
  OrgContext,
} from "../../../common/decorators/current-org.decorator";
import { TenantGuard } from "../../../common/middleware/tenant-context.guard";
import { OwnerOrAdminGuard } from "../../../common/guards/owner-or-admin.guard";
import { AiService, canManageAi } from "./ai.service";
import { BillingService } from "../billing/billing.service";

const AiCredentialSchema = z
  .object({
    provider: z.string().min(1).max(50),
    model: z.string().min(1).max(100),
    apiKey: z.string().max(5000).optional(),
    baseUrl: z.string().url().optional().nullable(),
  })
  .strict();

const ConnectionTestSchema = z
  .object({
    provider: z.string().min(1).max(50).optional(),
    model: z.string().min(1).max(100).optional(),
    apiKey: z.string().min(1).max(5000).optional(),
    baseUrl: z.string().url().optional().nullable(),
  })
  .strict()
  .default({});

export const ChatSchema = z
  .object({ message: z.string().trim().min(1).max(8000) })
  .strict();

const QUOTA_METRICS = ["ai_tokens", "rca_invocations"] as const;
const QUOTA_UNITS: Record<(typeof QUOTA_METRICS)[number], string> = {
  ai_tokens: "tokens",
  rca_invocations: "invocations",
};

const AiQuotaSchema = z
  .object({
    metric: z.enum(QUOTA_METRICS),
    limit: z.number().int().nonnegative().nullable(),
  })
  .strict();

@ApiTags("ai")
@ApiBearerAuth()
@Controller("ai")
@UseGuards(TenantGuard)
export class AiController {
  constructor(
    @Inject(AiService) private readonly service: Pick<
      AiService,
      | "get"
      | "save"
      | "remove"
      | "testConnection"
      | "providers"
      | "models"
      | "usage"
      | "chat"
    >,
    @Inject(BillingService) private readonly billing: Pick<
      BillingService,
      "setOrgQuota"
    >,
  ) {}

  @Get("config") get(@CurrentOrg() org: OrgContext) {
    return this.service.get(org.orgId, canManageAi(org.userRole));
  }

  @Put("config") save(
    @CurrentOrg() org: OrgContext,
    @Body({ schema: AiCredentialSchema })
    body: z.output<typeof AiCredentialSchema>,
  ) {
    this.assertManager(org);
    return this.service.save(org.orgId, body);
  }

  @Delete("config") remove(@CurrentOrg() org: OrgContext) {
    this.assertManager(org);
    return this.service.remove(org.orgId);
  }

  @Post("config/test") test(
    @CurrentOrg() org: OrgContext,
    @Body({ schema: ConnectionTestSchema })
    body: z.output<typeof ConnectionTestSchema>,
  ) {
    this.assertManager(org);
    const draft = body;
    return this.service.testConnection(
      org.orgId,
      draft.provider && draft.model && draft.apiKey ? draft : undefined,
    );
  }

  @Get("providers") providers(@CurrentOrg() org: OrgContext) {
    return this.service.providers(org.orgId, canManageAi(org.userRole));
  }

  @Get("providers/:providerId/models") async models(
    @CurrentOrg() org: OrgContext,
    @Param("providerId") providerId: string,
  ) {
    return { models: await this.service.models(providerId) };
  }

  @ApiOperation({
    summary: "AI usage this month",
    description:
      "Tokens and estimated cost split by who paid (platform-funded vs BYOK), plus RCA invocation totals. Cost is a price-list estimate, not billing reconciliation.",
  })
  @UseGuards(OwnerOrAdminGuard)
  @Get("usage") usage(@CurrentOrg() org: OrgContext) {
    return this.service.usage(org.orgId);
  }

  @Put("quota") setQuota(
    @CurrentOrg() org: OrgContext,
    @Body({ schema: AiQuotaSchema }) body: z.output<typeof AiQuotaSchema>,
  ) {
    this.assertManager(org);
    const input = body;
    return this.billing.setOrgQuota({
      orgId: org.orgId,
      metric: input.metric,
      limit: input.limit,
      unit: QUOTA_UNITS[input.metric],
    });
  }

  @Post("chat") chat(
    @CurrentOrg() org: OrgContext,
    @Body({ schema: ChatSchema }) body: z.output<typeof ChatSchema>,
  ) {
    const { message } = body;
    return this.service.chat(message, org.orgId);
  }

  private assertManager(org: OrgContext): void {
    if (!canManageAi(org.userRole)) {
      throw new ForbiddenException(
        "Only owners and admins can change AI settings",
      );
    }
  }
}
