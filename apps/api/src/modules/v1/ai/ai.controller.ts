import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Put,
  Query,
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
import { parseUsagePeriod } from "./ai-usage-period";
import { BillingService } from "../billing/billing.service";

const AiCredentialSchema = z
  .object({
    provider: z.string().min(1).max(50),
    model: z.string().min(1).max(100),
    apiKey: z.string().max(5000).optional(),
    baseUrl: z.string().url().optional().nullable(),
  })
  .strict();

const CredentialCreateSchema = z
  .object({
    name: z.string().trim().min(1).max(60).optional(),
    provider: z.string().min(1).max(50),
    model: z.string().min(1).max(200),
    apiKey: z.string().min(1).max(5000),
    baseUrl: z.string().url().optional().nullable(),
    isDefault: z.boolean().optional(),
  })
  .strict();

const CredentialPatchSchema = z
  .object({
    name: z.string().trim().min(1).max(60).optional(),
    model: z.string().min(1).max(200).optional(),
    apiKey: z.string().min(1).max(5000).optional(),
    baseUrl: z.string().url().optional().nullable(),
    isDefault: z.boolean().optional(),
  })
  .strict();

const LiveModelsSchema = z
  .object({
    credentialId: z.string().min(1).max(100).optional(),
    provider: z.string().min(1).max(50).optional(),
    apiKey: z.string().min(1).max(5000).optional(),
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
      | "list"
      | "create"
      | "update"
      | "removeCredential"
      | "liveModels"
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

  @Get("credentials") credentials(@CurrentOrg() org: OrgContext) {
    return this.service.list(org.orgId, canManageAi(org.userRole));
  }

  @Post("credentials") createCredential(
    @CurrentOrg() org: OrgContext,
    @Body({ schema: CredentialCreateSchema })
    body: z.output<typeof CredentialCreateSchema>,
  ) {
    this.assertManager(org);
    return this.service.create(org.orgId, body);
  }

  @Patch("credentials/:credentialId") updateCredential(
    @CurrentOrg() org: OrgContext,
    @Param("credentialId") credentialId: string,
    @Body({ schema: CredentialPatchSchema })
    body: z.output<typeof CredentialPatchSchema>,
  ) {
    this.assertManager(org);
    return this.service.update(org.orgId, credentialId, body);
  }

  @Delete("credentials/:credentialId") deleteCredential(
    @CurrentOrg() org: OrgContext,
    @Param("credentialId") credentialId: string,
  ) {
    this.assertManager(org);
    return this.service.removeCredential(org.orgId, credentialId);
  }

  @Post("credentials/:credentialId/test") testCredential(
    @CurrentOrg() org: OrgContext,
    @Param("credentialId") credentialId: string,
  ) {
    this.assertManager(org);
    return this.service.testConnection(org.orgId, undefined, credentialId);
  }

  @Post("models") liveModels(
    @CurrentOrg() org: OrgContext,
    @Body({ schema: LiveModelsSchema })
    body: z.output<typeof LiveModelsSchema>,
  ) {
    this.assertManager(org);
    return this.service.liveModels(org.orgId, body);
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
    summary: "AI usage for a period",
    description:
      "Tokens and estimated cost for ?period=month (default), last_month or last_30_days, split by who paid (platform-funded vs BYOK), plus RCA invocation totals. Cost is a price-list estimate, not billing reconciliation.",
  })
  @UseGuards(OwnerOrAdminGuard)
  @Get("usage") usage(@CurrentOrg() org: OrgContext, @Query("period") period?: string) {
    return this.service.usage(org.orgId, parseUsagePeriod(period));
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
