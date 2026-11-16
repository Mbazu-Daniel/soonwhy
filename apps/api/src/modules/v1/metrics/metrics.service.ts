import { Injectable } from "@nestjs/common";
import { MetricsRepository } from "./metrics.repository";
import { GetMetricPercentilesInput, GetMetricsInput, GetSummaryInput } from "./dto";
import { summarize } from "./request-summary";

@Injectable()
export class MetricsService {
  constructor(private readonly metricsRepository: MetricsRepository) {}

  async getMetrics(orgId: string, input: GetMetricsInput) {
    const buckets = await this.metricsRepository.queryMetrics({
      orgId,
      projectId: input.projectId,
      from: input.from ?? new Date(0).toISOString(),
      to: input.to ?? new Date().toISOString(),
      interval: input.interval,
      service: input.service || "",
    });

    return {
      buckets: buckets.map((b) => ({
        bucket: b.bucket,
        count: b.count,
        p50: Number.isFinite(b.p50) ? Number(b.p50.toPrecision(12)) : 0,
        p95: Number.isFinite(b.p95) ? Number(b.p95.toPrecision(12)) : 0,
        p99: Number.isFinite(b.p99) ? Number(b.p99.toPrecision(12)) : 0,
        statusCodes: { _2xx: b._2xx, _3xx: b._3xx, _4xx: b._4xx, _5xx: b._5xx },
      })),
    };
  }

  async getSummary(orgId: string, input: GetSummaryInput) {
    const raw = await this.metricsRepository.querySummary({
      orgId,
      projectId: input.projectId,
      from: input.from ?? new Date(Date.now() - 86_400_000).toISOString(),
      to: input.to ?? new Date().toISOString(),
      service: input.service || undefined,
    });
    return summarize(raw);
  }

  async getMetricPercentiles(orgId: string, input: GetMetricPercentilesInput) {
    return this.metricsRepository.queryMetricPercentiles({
      orgId,
      projectId: input.projectId,
      metricName: input.metricName,
      from: input.from ?? new Date(0).toISOString(),
      to: input.to ?? new Date().toISOString(),
      service: input.service,
    });
  }

  async getHostMetrics(
    orgId: string,
    input: { from?: string; to?: string; interval?: string },
  ) {
    const buckets = await this.metricsRepository.queryHostMetrics({
      orgId,
      from: input.from ?? new Date(Date.now() - 3600000).toISOString(),
      to: input.to ?? new Date().toISOString(),
      interval: input.interval ?? "1m",
    });

    return {
      buckets,
    };
  }
}
