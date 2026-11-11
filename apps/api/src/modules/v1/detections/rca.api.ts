import { Inject, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { RcaAnalysisRepository } from "./rca.repository";
import { RcaPersistenceService } from "./rca.persistence";
import { RcaService } from "./rca.service";
import { buildRcaEvidence } from "./rca.evidence";
import type { CorrelatedBottleneck } from "./detection.correlation";
import {
  DatabaseRcaGovernanceSink,
  getRcaErrorCode,
  toRcaUsageFields,
} from "./rca.governance";
import { toRcaHttpException } from "./rca.provider";
import { generateId } from "../../../common/db/generate-id";
import { BillingService } from "../billing/billing.service";
import { QuotaExceededError } from "../billing/billing.errors";
import { aiQuotaExceeded } from "../ai/ai.errors";
import {
  readAiQuotaConfig,
  type AiQuotaConfig,
} from "../ai/llm-provider.config";
import type { LlmCredentialSummary } from "../ai/llm-provider.resolver";
import type { RcaAnalysisOutcome } from "./rca.types";

type UsageEvent = Parameters<BillingService["recordUsage"]>[0];

@Injectable()
export class RcaApiService {
  private static readonly logger = new Logger(RcaApiService.name);
  private readonly quota: AiQuotaConfig = readAiQuotaConfig();

  constructor(
    @Inject(RcaAnalysisRepository) private readonly repository: Pick<
      RcaAnalysisRepository,
      "findFinding"
    >,
    @Inject(RcaService) private readonly rcaService: Pick<
      RcaService,
      "analyze" | "describe"
    >,
    @Inject(RcaPersistenceService) private readonly persistence: Pick<
      RcaPersistenceService,
      "findLatest" | "list" | "persist"
    >,
    private readonly governance: DatabaseRcaGovernanceSink,
    @Inject(BillingService) private readonly billing: Pick<
      BillingService,
      "assertQuota" | "recordUsage"
    >,
  ) {}

  async getLatest(orgId: string, projectId: string, findingId: string) {
    await this.assertFinding(orgId, projectId, findingId);
    return this.persistence.findLatest(orgId, projectId, findingId);
  }

  async getHistory(orgId: string, projectId: string, findingId: string) {
    await this.assertFinding(orgId, projectId, findingId);
    return this.persistence.list(orgId, projectId, findingId);
  }

  async generate(
    orgId: string,
    projectId: string,
    findingId: string,
    regenerate: boolean,
  ) {
    const finding = await this.assertFinding(orgId, projectId, findingId);
    if (!regenerate) {
      const existing = await this.persistence.findLatest(
        orgId,
        projectId,
        findingId,
      );
      if (existing) return existing;
    }

    const bottleneck = this.toBottleneck(finding);
    if (!bottleneck) {
      throw new NotFoundException(
        "Finding does not contain an RCA-supported bottleneck",
      );
    }

    const invocationId = generateId();
    const unresolved = {
      id: invocationId,
      orgId,
      projectId,
      findingId,
      provider: "unknown",
      model: "unknown",
      promptVersion: "unknown",
      credentialSource: null,
      credentialId: null,
      requestDurationMs: 0,
      retries: 0,
    };

    try {
      const credential = await this.rcaService.describe(orgId);
      await this.reserveQuota(orgId, credential);
      const result = await this.rcaService.analyze(
        orgId,
        projectId,
        bottleneck,
      );
      const evidence = buildRcaEvidence(projectId, bottleneck);
      const persisted = await this.persistence.persist({
        orgId,
        projectId,
        findingId,
        evidence,
        analysis: result.analysis,
        provider: result.credential.providerId,
        model: result.credential.model,
        promptVersion: result.promptVersion,
        credentialSource: result.credential.source,
        usage: result.usage,
      });
      await this.governance.recordSuccess({
        id: invocationId,
        orgId,
        projectId,
        findingId,
        provider: result.credential.providerId,
        model: result.credential.model,
        promptVersion: result.promptVersion,
        credentialSource: result.credential.source,
        credentialId: result.credential.credentialId,
        ...toRcaUsageFields(result.usage),
      });
      const overrun = await this.meter(orgId, projectId, invocationId, result);
      return overrun ? { ...persisted, quotaWarning: true } : persisted;
    } catch (error) {
      await this.governance.recordFailure({
        ...unresolved,
        errorCode: getRcaErrorCode(error),
      });
      throw toRcaHttpException(error);
    }
  }

  /**
   * Only platform-funded calls draw on the organisation's allowance; a key the
   * organisation paid for itself cannot exhaust it. The check reserves nothing,
   * so it can let a request through that the post-spend metering then rejects.
   */
  private async reserveQuota(
    orgId: string,
    credential: LlmCredentialSummary,
  ): Promise<void> {
    if (!this.quota.enforced || credential.source !== "platform") return;

    try {
      await this.billing.assertQuota(orgId, "rca_invocations", 1);
      await this.billing.assertQuota(
        orgId,
        "ai_tokens",
        this.quota.tokenReserve,
      );
    } catch (error) {
      if (error instanceof QuotaExceededError) {
        throw aiQuotaExceeded(error.metric);
      }
      throw error;
    }
  }

  /**
   * Spend is recorded once the analysis exists. Unwinding it would hide what the
   * organisation was actually charged for, so an overrun after the fact is
   * reported on the response instead of discarding the result, and a billing
   * outage never fails a request whose tokens are already spent.
   */
  private async meter(
    orgId: string,
    projectId: string,
    invocationId: string,
    result: RcaAnalysisOutcome,
  ): Promise<boolean> {
    const byok = result.credential.source === "byok";
    const tokens = result.usage.totalTokens ?? 0;
    const events: UsageEvent[] = [];
    if (tokens > 0) {
      events.push({
        orgId,
        projectId,
        metric: byok ? "ai_tokens_byok" : "ai_tokens",
        quantity: tokens,
        source: "rca",
        idempotencyKey: `${invocationId}:tokens`,
        enforce: !byok,
        metadata: { credentialSource: result.credential.source },
      });
    }
    events.push({
      orgId,
      projectId,
      metric: "rca_invocations",
      quantity: 1,
      source: "rca",
      idempotencyKey: invocationId,
      enforce: true,
      metadata: tokens > 0 ? {} : { tokensUnreported: true },
    });

    let exceeded = false;
    for (const event of events) {
      try {
        await this.billing.recordUsage(event);
      } catch (error) {
        if (error instanceof QuotaExceededError) {
          exceeded = true;
          continue;
        }
        RcaApiService.logger.warn(
          `AI usage could not be recorded for invocation ${invocationId}`,
        );
      }
    }
    return exceeded;
  }

  private async assertFinding(
    orgId: string,
    projectId: string,
    findingId: string,
  ) {
    const finding = await this.repository.findFinding(
      orgId,
      projectId,
      findingId,
    );
    if (!finding) throw new NotFoundException("Finding not found");
    return finding;
  }

  private toBottleneck(
    finding: Awaited<ReturnType<RcaAnalysisRepository["findFinding"]>>,
  ): CorrelatedBottleneck | null {
    if (!finding || finding.type !== "bottleneck") return null;
    const evidence = finding.evidence;
    const correlated = evidence.find(
      (item) => item.label === "correlated-signal",
    );
    if (!correlated) return null;

    const latencyId = String(correlated.context?.sourceFindingId ?? "");
    if (!latencyId) return null;

    const guidance = evidence.find(
      (item) => item.label === "optimization-guidance",
    );
    const supportingFindings = evidence
      .filter((item) => item.label === "supporting-finding")
      .map((item) => ({
        id: String(item.context?.findingId ?? ""),
        projectId: finding.projectId,
        serviceName: finding.serviceName,
        type: String(
          item.context?.findingType ?? "latency",
        ) as CorrelatedBottleneck["supportingFindings"][number]["type"],
        severity: String(item.context?.severity ?? "warning") as
          | "warning"
          | "critical",
        title: String(item.context?.findingType ?? "Supporting finding"),
        description: "",
        observedValue: Number(item.value),
        threshold: 0,
        unit: "unknown",
        window: { start: finding.windowStart, end: finding.windowEnd },
        evidence: [item],
      }));

    return {
      serviceName: finding.serviceName,
      latency: {
        id: latencyId,
        projectId: finding.projectId,
        serviceName: finding.serviceName,
        type: "latency",
        severity: finding.severity as "warning" | "critical",
        title: "Correlated latency",
        description: finding.description,
        observedValue: finding.observedValue,
        threshold: finding.threshold,
        unit: finding.unit,
        window: { start: finding.windowStart, end: finding.windowEnd },
        evidence: [correlated],
      },
      supportingFindings,
      recommendation: String(guidance?.value ?? ""),
      dependencyType:
        typeof guidance?.context?.dependencyType === "string"
          ? guidance.context.dependencyType
          : undefined,
      dependencyName:
        typeof guidance?.context?.dependencyName === "string"
          ? guidance.context.dependencyName
          : undefined,
      traceIds: evidence
        .filter((item) => item.label === "correlated-trace")
        .map((item) => String(item.value)),
    };
  }
}
