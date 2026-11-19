import { Injectable } from "@nestjs/common";
import type { RcaUsage } from "./rca.types";
import { db } from "../../../../../common/db";
import { rcaInvocations } from "../../../../../common/db/schema";
import { recordAiInvocationMetrics } from "../../../../../common/telemetry/otel-metrics";
import type { RcaInvocationRecord, RcaGovernanceSink } from "./rca.governance.types";

@Injectable()
export class DatabaseRcaGovernanceSink implements RcaGovernanceSink {
  async recordSuccess(
    input: Omit<RcaInvocationRecord, "status" | "createdAt" | "errorCode">,
  ): Promise<void> {
    recordAiInvocationMetrics({
      provider: input.provider,
      model: input.model,
      status: "succeeded",
      durationMs: input.requestDurationMs,
      inputTokens: input.inputTokens,
      outputTokens: input.outputTokens,
      estimatedCostUsd: input.estimatedCostUsd,
    });
    await db
      .insert(rcaInvocations)
      .values({ ...input, status: "succeeded" });
  }

  async recordFailure(
    input: Omit<RcaInvocationRecord, "status" | "createdAt"> & {
      errorCode?: string;
    },
  ): Promise<void> {
    recordAiInvocationMetrics({
      provider: input.provider,
      model: input.model,
      status: "failed",
      durationMs: input.requestDurationMs,
    });
    await db
      .insert(rcaInvocations)
      .values({ ...input, status: "failed" });
  }
}

export function toRcaUsageFields(usage: RcaUsage) {
  return {
    requestDurationMs: usage.requestDurationMs,
    retries: usage.retries,
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    totalTokens: usage.totalTokens,
    estimatedCostUsd: usage.estimatedCostUsd,
  };
}

export function getRcaErrorCode(error: unknown): string {
  const coded = (error as { response?: { code?: unknown } } | null)?.response;
  if (typeof coded?.code === "string") return coded.code;
  if (error instanceof Error) return error.name;
  return "UnknownError";
}
