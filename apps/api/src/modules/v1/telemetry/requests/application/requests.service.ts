import { Injectable } from "@nestjs/common";
import { RequestsRepository } from "../infrastructure/requests.repository";
import { GetRequestsStatsInput } from "../domain/dto";
import { DEFAULT_WINDOW_MS } from "../domain/endpoint-health.constants";
import { assessEndpoints } from "../domain/endpoint-health";

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

  async getEndpointHealth(orgId: string, input: GetRequestsStatsInput) {
    const to = input.to ? new Date(input.to) : new Date();
    const from = input.from ? new Date(input.from) : new Date(to.getTime() - DEFAULT_WINDOW_MS);
    const span = to.getTime() - from.getTime();
    const previousFrom = new Date(from.getTime() - span);
    const query = (start: Date, end: Date) =>
      this.requestsRepository
        .queryStats({ orgId, projectId: input.projectId, from: start.toISOString(), to: end.toISOString() })
        .then((rows) => rows.map((row) => ({ ...row, url: this.normalizeUrl(row.url) })));
    const [current, previous] = await Promise.all([query(from, to), query(previousFrom, from)]);
    return { from: from.toISOString(), to: to.toISOString(), ...assessEndpoints(current, previous) };
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
