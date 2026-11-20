import { Inject, Injectable, Logger } from "@nestjs/common";
import { and, desc, eq, gte, inArray } from "drizzle-orm";
import { Agent } from "@mastra/core/agent";
import { db } from "../../../../../common/db";
import { findings } from "../../../../../common/db/schema/findings";
import { incidents } from "../../../../../common/db/schema/incidents";
import { CacheService } from "../../../../../common/cache/cache.service";
import { CACHE_TTL_SECONDS } from "../../../../../common/cache/cache.constants";
import { DashboardService } from "../../../platform/dashboard/application/dashboard.service";
import { LlmProviderResolver } from "../../../investigation/ai/application/llm-provider.resolver";
import { buildPrompt, buildStats, deterministicSummary } from "./summary-context";
import { type OverviewStats, type SummaryFinding } from "./summary-context.types";
import { SUMMARY_INSTRUCTIONS } from "./summary-context.constants";
import type { AiSummary } from "./ai-summary.service.types";

const SUMMARY_TIMEOUT_MS = 20_000;
const RANGE_LABEL = "24h";

@Injectable()
export class AiSummaryService {
  private readonly logger = new Logger(AiSummaryService.name);

  constructor(
    @Inject(DashboardService) private readonly dashboard: DashboardService,
    @Inject(LlmProviderResolver) private readonly resolver: LlmProviderResolver,
    private readonly cache: CacheService,
  ) {}

  async get(
    orgId: string,
    projectId: string,
    options: { refresh?: boolean } = {},
  ): Promise<AiSummary> {
    const cacheKey = `ai-summary:${orgId}:${projectId}:${RANGE_LABEL}`;
    if (options.refresh) {
      await this.cache.delete(cacheKey);
    }
    return this.cache.getOrSet(cacheKey, CACHE_TTL_SECONDS.summary, () =>
      this.generate(orgId, projectId),
    );
  }

  private async generate(orgId: string, projectId: string): Promise<AiSummary> {
    const [overview, summaryFindings, openIncidents] = await Promise.all([
      this.dashboard.getOverview(orgId, projectId),
      this.recentFindings(orgId, projectId),
      this.openIncidents(orgId, projectId),
    ]);
    const stats = buildStats({
      overview: { ...overview } as OverviewStats,
      findings: summaryFindings,
      openIncidents,
    });
    const byok = await this.withByok(orgId, (provider, model, apiKey, baseUrl) =>
      this.generateWithLlm(stats, provider, model, apiKey, baseUrl),
    );
    if (byok) return byok;
    return {
      summary: deterministicSummary(stats),
      source: "deterministic",
      provider: null,
      model: null,
      generatedAt: new Date().toISOString(),
    };
  }

  private async withByok(
    orgId: string,
    run: (
      provider: string,
      model: string,
      apiKey: string,
      baseUrl: string | null,
    ) => Promise<AiSummary | null>,
  ): Promise<AiSummary | null> {
    const credential = await this.resolver.describe(orgId);
    if (credential.source !== "byok") return null;
    try {
      const resolved = await this.resolver.resolve(orgId);
      if (resolved.baseUrl && !isAllowedBaseUrl(resolved.baseUrl)) {
        this.logger.warn("Ignoring AI summary credential with a non-https base URL");
        return null;
      }
      return await run(
        resolved.providerId,
        resolved.model,
        resolved.apiKey,
        resolved.baseUrl,
      );
    } catch (error) {
      this.logger.warn(
        `AI summary fell back to deterministic text: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return null;
    }
  }

  private async generateWithLlm(
    stats: ReturnType<typeof buildStats>,
    provider: string,
    model: string,
    apiKey: string,
    baseUrl: string | null,
  ): Promise<AiSummary | null> {
    const agent = new Agent({
      id: "soonwhy-summary",
      name: "Soonwhy summary",
      instructions: SUMMARY_INSTRUCTIONS,
      model: {
        providerId: provider,
        modelId: model,
        ...(baseUrl ? { url: baseUrl } : {}),
        apiKey,
      },
    });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), SUMMARY_TIMEOUT_MS);
    try {
      const result = await agent.generate(buildPrompt(stats), {
        abortSignal: controller.signal,
        modelSettings: { temperature: 0.2, maxRetries: 0 },
      });
      const summary = result.text?.trim() ?? "";
      if (!summary || summary.length > 500) {
        this.logger.warn("AI summary returned an empty or oversized response");
        return null;
      }
      return {
        summary,
        source: "byok",
        provider,
        model,
        generatedAt: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.warn(
        `AI summary generation failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }

  private async recentFindings(
    orgId: string,
    projectId: string,
  ): Promise<SummaryFinding[]> {
    const since = new Date(Date.now() - 86_400_000);
    const rows = await db
      .select({
        severity: findings.severity,
        title: findings.title,
        serviceName: findings.serviceName,
        detectedAt: findings.detectedAt,
      })
      .from(findings)
      .where(
        and(
          eq(findings.orgId, orgId),
          eq(findings.projectId, projectId),
          gte(findings.detectedAt, since),
        ),
      )
      .orderBy(desc(findings.detectedAt))
      .limit(25);
    return rows;
  }

  private async openIncidents(
    orgId: string,
    projectId: string,
  ): Promise<number> {
    const rows = await db
      .select({ id: incidents.id })
      .from(incidents)
      .where(
        and(
          eq(incidents.orgId, orgId),
          eq(incidents.projectId, projectId),
          inArray(incidents.status, ["firing", "acknowledged"]),
        ),
      )
      .limit(50);
    return rows.length;
  }
}

function isAllowedBaseUrl(baseUrl: string): boolean {
  try {
    const url = new URL(baseUrl);
    if (url.protocol === "https:") return true;
    return (
      url.protocol === "http:" &&
      (url.hostname === "localhost" || url.hostname === "127.0.0.1")
    );
  } catch {
    return false;
  }
}
