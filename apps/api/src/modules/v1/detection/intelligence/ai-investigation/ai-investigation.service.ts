import { Injectable, Logger, Optional } from "@nestjs/common";
import { Agent } from "@mastra/core/agent";
import type {
  InvestigationRequest,
  InvestigationResult,
  InvestigationProgress,
  EvidenceBundle,
} from "./ai-investigation.types";
import { randomUUID } from "node:crypto";
import { withRetry, isRetryableError } from "../../../../../common/utils/retry";
import { CircuitBreaker } from "../../../../../common/utils/circuit-breaker";
import { DeadLetterInvestigationRepository } from "./dead-letter.repository";
import { generateStructured } from "../../../investigation/ai/domain/structured-output";
import { AIInvestigationRepository } from "./ai-investigation.repository";
import { INVESTIGATION_AGENT_INSTRUCTIONS, buildInvestigationPrompt, limitList, shortenInvestigationText } from "./ai-investigation.prompt";

type InvestigationStatus = InvestigationProgress["status"];

const ALLOWED_TRANSITIONS: Record<InvestigationStatus, ReadonlySet<InvestigationStatus>> = {
  pending: new Set(["analyzing", "failed"]),
  analyzing: new Set(["analyzing", "complete", "failed"]),
  complete: new Set(),
  failed: new Set(),
};

@Injectable()
export class AIInvestigationService {
  private readonly logger = new Logger(AIInvestigationService.name);
  private readonly investigations = new Map<string, InvestigationProgress>();
  private readonly results = new Map<string, InvestigationResult>();
  private readonly organizationsByInvestigation = new Map<string, string>();
  private readonly projectsByInvestigation = new Map<string, string>();
  private readonly circuitBreaker = new CircuitBreaker({
    failureThreshold: 5,
    successThreshold: 2,
    resetTimeoutMs: 60000,
    onStateChange: (state) => this.logger.warn(`AI Investigation circuit breaker state: ${state}`),
  });

  constructor(
    @Optional() private readonly deadLetterRepo?: DeadLetterInvestigationRepository,
    @Optional() private readonly investigationRepo?: AIInvestigationRepository,
  ) {
  }

  private transitionProgress(
    investigationId: string,
    next: Partial<Omit<InvestigationProgress, "investigationId">> & { status: InvestigationStatus },
  ): InvestigationProgress | undefined {
    const current = this.investigations.get(investigationId);
    if (!current) return undefined;
    const allowed = ALLOWED_TRANSITIONS[current.status];
    if (!allowed.has(next.status)) {
      this.logger.warn(
        `Ignored invalid investigation transition ${investigationId}: ${current.status} -> ${next.status}`,
      );
      return current;
    }
    const updated: InvestigationProgress = {
      ...current,
      ...next,
      investigationId,
      progress:
        typeof next.progress === "number"
          ? Math.max(0, Math.min(100, next.progress))
          : current.progress,
    };
    this.investigations.set(investigationId, updated);
    return updated;
  }

  private async persistProgress(investigationId: string): Promise<void> {
    const orgId = this.organizationsByInvestigation.get(investigationId);
    const projectId = this.projectsByInvestigation.get(investigationId);
    const progress = this.investigations.get(investigationId);
    if (!orgId || !progress || !this.investigationRepo) return;
    try {
      if (progress.status === "pending" && projectId) {
        await this.investigationRepo.createInvestigation(
          orgId,
          investigationId,
          projectId,
        );
      } else if (progress.status === "analyzing") {
        await this.investigationRepo.updateProgress(
          orgId,
          investigationId,
          progress.progress,
          progress.currentStep,
        );
      }
    } catch (error) {
      this.logger.warn(
        `Failed to persist investigation progress ${investigationId}: ${String(error)}`,
      );
    }
  }

  async startInvestigation(
    request: InvestigationRequest,
    organizationId?: string,
  ): Promise<string> {
    const investigationId = randomUUID();

    this.projectsByInvestigation.set(investigationId, request.projectId);
    this.investigations.set(investigationId, {
      investigationId,
      status: "pending",
      progress: 0,
      currentStep: "Initializing",
    });

    if (organizationId) {
      this.organizationsByInvestigation.set(investigationId, organizationId);
      if (this.investigationRepo) {
        try {
          await this.investigationRepo.createInvestigation(
            organizationId,
            investigationId,
            request.projectId,
          );
        } catch (error) {
          this.logger.warn(
            `Failed to create persisted investigation ${investigationId}: ${String(error)}`,
          );
        }
      }
    }

    this.runInvestigation(investigationId, request, organizationId).catch((error) => {
      void this.markFailed(
        investigationId,
        error instanceof Error ? error.message : String(error),
        organizationId,
      );

      if (this.deadLetterRepo && organizationId) {
        this.deadLetterRepo
          .addFailedInvestigation(
            organizationId,
            investigationId,
            request.projectId,
            request,
            error instanceof Error ? error.message : String(error),
            1,
            new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          )
          .catch((dlqError) => {
            this.logger.error(`Failed to add to dead letter queue: ${dlqError}`);
          });
      }
    });

    return investigationId;
  }

  private ownedBy(investigationId: string, organizationId?: string): boolean {
    const owner = this.organizationsByInvestigation.get(investigationId);
    return !organizationId || !owner || owner === organizationId;
  }

  async getInvestigationProgress(investigationId: string, organizationId?: string): Promise<InvestigationProgress | undefined> {
    if (!this.ownedBy(investigationId, organizationId)) return undefined;
    const inMemory = this.investigations.get(investigationId);
    if (inMemory) return inMemory;

    const orgId = organizationId ?? this.organizationsByInvestigation.get(investigationId);
    if (orgId && this.investigationRepo) {
      try {
        const persisted = await this.investigationRepo.getProgress(orgId, investigationId);
        if (persisted) return persisted;
      } catch (error) {
        this.logger.warn(`Failed to load persisted investigation progress ${investigationId}: ${String(error)}`);
      }
    }

    return undefined;
  }

  async getInvestigationResult(investigationId: string, organizationId?: string): Promise<InvestigationResult | undefined> {
    if (!this.ownedBy(investigationId, organizationId)) return undefined;
    const inMemory = this.results.get(investigationId);
    if (inMemory) return inMemory;

    const orgId = organizationId ?? this.organizationsByInvestigation.get(investigationId);
    if (orgId && this.investigationRepo) {
      try {
        const persisted = await this.investigationRepo.getResult(orgId, investigationId);
        if (persisted) return persisted;
      } catch (error) {
        this.logger.warn(`Failed to load persisted investigation result ${investigationId}: ${String(error)}`);
      }
    }

    return undefined;
  }

  private async runInvestigation(
    investigationId: string,
    request: InvestigationRequest,
    organizationId?: string,
  ): Promise<void> {
    const progress = this.investigations.get(investigationId);
    if (!progress) return;

    if (organizationId) this.organizationsByInvestigation.set(investigationId, organizationId);

    this.transitionProgress(investigationId, {
      status: "analyzing",
      progress: 10,
      currentStep: "Building evidence summary",
    });
    await this.persistAnalyzing(investigationId);

    const evidenceSummary = this.buildEvidenceSummary(request.evidenceBundle);

    this.transitionProgress(investigationId, {
      status: "analyzing",
      progress: 30,
      currentStep: "Analyzing evidence with AI",
    });
    await this.persistAnalyzing(investigationId);

    const agent = this.createAgent(request.modelConfig);
    const prompt = buildInvestigationPrompt(evidenceSummary, request.question);

    try {
      const result = await this.circuitBreaker.execute(() =>
        withRetry(
          async () => {
            return await generateStructured((jsonPromptInjection) =>
              agent.generate(prompt, {
                structuredOutput: {
                  schema: this.getInvestigationSchema(),
                  jsonPromptInjection,
                },
                modelSettings: {
                  temperature: request.modelConfig?.temperature ?? 0.3,
                },
              }),
            );
          },
          {
            maxAttempts: 3,
            initialDelayMs: 1000,
            maxDelayMs: 10000,
            retryableErrors: isRetryableError,
            onRetry: (attempt, error) => {
              this.logger.warn(`AI investigation retry attempt ${attempt}: ${error}`);
            },
          },
        ),
      );

      this.transitionProgress(investigationId, {
        status: "analyzing",
        progress: 80,
        currentStep: "Processing results",
      });
      await this.persistAnalyzing(investigationId);

      const analysis = this.parseInvestigationResult(
        result.object as Record<string, unknown>,
        request,
        investigationId,
      );

      this.results.set(investigationId, analysis);
      this.transitionProgress(investigationId, {
        status: "complete",
        progress: 100,
        currentStep: "Complete",
      });

      const orgId = this.organizationsByInvestigation.get(investigationId);
      if (orgId && this.investigationRepo) {
        try {
          await this.investigationRepo.completeInvestigation(orgId, investigationId, analysis);
        } catch (persistError) {
          this.logger.warn(`Failed to persist completed investigation ${investigationId}: ${String(persistError)}`);
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      await this.markFailed(investigationId, message, organizationId);
      this.logger.error(`Investigation ${investigationId} failed:`, error);
      throw error;
    }
  }

  private async persistAnalyzing(investigationId: string): Promise<void> {
    const orgId = this.organizationsByInvestigation.get(investigationId);
    const progress = this.investigations.get(investigationId);
    if (!orgId || !progress || !this.investigationRepo) return;
    try {
      await this.investigationRepo.updateProgress(
        orgId,
        investigationId,
        progress.progress,
        progress.currentStep,
      );
    } catch (error) {
      this.logger.warn(`Failed to persist analyzing investigation ${investigationId}: ${String(error)}`);
    }
  }

  private async markFailed(
    investigationId: string,
    message: string,
    organizationId?: string,
  ): Promise<void> {
    if (organizationId) this.organizationsByInvestigation.set(investigationId, organizationId);
    this.transitionProgress(investigationId, {
      status: "failed",
      currentStep: `Error: ${message}`,
    });
    const orgId = this.organizationsByInvestigation.get(investigationId);
    if (orgId && this.investigationRepo) {
      try {
        await this.investigationRepo.failInvestigation(orgId, investigationId, message);
      } catch (error) {
        this.logger.warn(`Failed to persist failed investigation ${investigationId}: ${String(error)}`);
      }
    }
  }

  private buildEvidenceSummary(bundle: EvidenceBundle): string {
    const lines: string[] = [];

    lines.push(`Time Window: ${bundle.timeWindow.start} to ${bundle.timeWindow.end}`);
    lines.push(`Total Findings: ${bundle.findings.length}`);
    lines.push(`Total Correlations: ${bundle.correlations.length}`);
    lines.push(`Graph Paths: ${bundle.graphPaths.length}`);
    lines.push("");

    lines.push("=== FINDINGS ===");
    for (const finding of bundle.findings) {
      lines.push(`- [${finding.severity.toUpperCase()}] ${finding.findingType}`);
      lines.push(`  Confidence: ${(finding.confidence * 100).toFixed(0)}%`);
      lines.push(`  Evidence: ${finding.evidence.join("; ")}`);
      lines.push("");
    }

    lines.push("=== CORRELATIONS ===");
    for (const correlation of bundle.correlations) {
      lines.push(`- ${correlation.type}: strength ${(correlation.strength * 100).toFixed(0)}%`);
      lines.push(`  Source: ${correlation.source.domain}:${correlation.source.operationName}`);
      lines.push(`  Target: ${correlation.target.domain}:${correlation.target.operationName}`);
      lines.push("");
    }

    lines.push("=== GRAPH PATHS ===");
    for (const path of bundle.graphPaths) {
      lines.push(`- Path strength: ${(path.totalStrength * 100).toFixed(0)}%`);
      lines.push(`  Nodes: ${path.nodes.map((n) => `${n.domain}:${n.operationName}`).join(" -> ")}`);
      lines.push("");
    }

    return lines.join("\n");
  }

  private createAgent(config?: InvestigationRequest["modelConfig"]): Agent {
    const provider = config?.provider || "openai";
    const model = config?.model || "gpt-4";

    return new Agent({
      id: "soonwhy-investigation",
      name: "Soonwhy Investigation",
      instructions: INVESTIGATION_AGENT_INSTRUCTIONS,
      model: {
        providerId: provider,
        modelId: model,
        apiKey: process.env.MASTRA_API_KEY || "",
      },
    });
  }

  private getInvestigationSchema(): Record<string, unknown> {
    return {
      type: "object",
      properties: {
        summary: { type: "string" },
        rootCause: {
          type: "object",
          properties: {
            primaryCause: { type: "string" },
            contributingFactors: { type: "array", items: { type: "string" } },
            affectedComponents: { type: "array", items: { type: "string" } },
            impactAssessment: {
              type: "object",
              properties: {
                severity: { type: "string", enum: ["low", "medium", "high", "critical"] },
                affectedUsers: { type: "number" },
                affectedEndpoints: { type: "array", items: { type: "string" } },
              },
            },
          },
        },
        explanation: { type: "string" },
        recommendations: { type: "array", items: { type: "string" } },
        confidence: { type: "number" },
        evidenceCitations: {
          type: "array",
          items: {
            type: "object",
            properties: {
              findingId: { type: "string" },
              relevance: { type: "number" },
              excerpt: { type: "string" },
            },
          },
        },
        relatedFindings: { type: "array", items: { type: "string" } },
      },
      required: ["summary", "rootCause", "explanation", "recommendations", "confidence"],
    };
  }

  private parseInvestigationResult(
    result: Record<string, unknown>,
    request: InvestigationRequest,
    investigationId: string,
  ): InvestigationResult {
    const rootCause =
      result.rootCause && typeof result.rootCause === "object"
        ? (result.rootCause as InvestigationResult["rootCause"])
        : {
            primaryCause: "Unknown",
            contributingFactors: [],
            affectedComponents: [],
            impactAssessment: { severity: "medium" as const },
          };

    return {
      investigationId,
      summary: typeof result.summary === "string" ? shortenInvestigationText(result.summary, 400) : "No summary provided",
      rootCause: {
        ...rootCause,
        primaryCause: shortenInvestigationText(rootCause.primaryCause ?? "Unknown", 300),
        contributingFactors: limitList(rootCause.contributingFactors ?? []),
        affectedComponents: limitList(rootCause.affectedComponents ?? []),
      },
      explanation:
        typeof result.explanation === "string"
          ? shortenInvestigationText(result.explanation, 800)
          : "No explanation provided",
      recommendations: Array.isArray(result.recommendations)
        ? limitList((result.recommendations as string[]).map((item) => shortenInvestigationText(String(item), 300)))
        : [],
      confidence:
        typeof result.confidence === "number" ? result.confidence : 0.5,
      evidenceCitations: Array.isArray(result.evidenceCitations)
        ? (result.evidenceCitations as InvestigationResult["evidenceCitations"])
        : [],
      relatedFindings: Array.isArray(result.relatedFindings)
        ? (result.relatedFindings as string[])
        : [],
      timestamp: new Date().toISOString(),
      modelUsed: request.modelConfig?.model || "gpt-4",
      tokensUsed: result.tokensUsed as InvestigationResult["tokensUsed"],
      costUsd: typeof result.costUsd === "number" ? result.costUsd : undefined,
    };
  }

  clearInvestigation(investigationId: string, organizationId: string): boolean {
    if (this.organizationsByInvestigation.get(investigationId) !== organizationId) return false;
    this.investigations.delete(investigationId);
    this.results.delete(investigationId);
    this.organizationsByInvestigation.delete(investigationId);
    this.projectsByInvestigation.delete(investigationId);
    return true;
  }
}
