import { Injectable } from "@nestjs/common";
import { RequestsRepository } from "../infrastructure/requests.repository";
import { GetRequestsStatsInput } from "../domain/dto";

@Injectable()
export class RequestsService {
  constructor(private readonly requestsRepository: RequestsRepository) {}

  private normalizeUrl(url: string): string {
    return url
      .replace(/\/\d+/g, "/:id")
      .replace(
        /\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
        "/:id",
      );
  }

  async getStats(orgId: string, input: GetRequestsStatsInput) {
    const stats = await this.requestsRepository.queryStats({
      orgId,
      projectId: input.projectId,
      from: input.from ?? new Date(0).toISOString(),
      to: input.to ?? new Date().toISOString(),
    });
    return {
      data: stats.map((s) => ({
        url: this.normalizeUrl(s.url),
        method: s.method,
        count: s.count,
        p50: Number.isFinite(s.p50) ? Number(s.p50.toPrecision(12)) : 0,
        p95: Number.isFinite(s.p95) ? Number(s.p95.toPrecision(12)) : 0,
        p99: Number.isFinite(s.p99) ? Number(s.p99.toPrecision(12)) : 0,
        errorRate: Math.round(s.errorRate * 100) / 100,
      })),
    };
  }
}
