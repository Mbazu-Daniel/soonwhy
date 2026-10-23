import { Injectable } from '@nestjs/common';
import { RequestsRepository } from './requests.repository';
import { GetRequestsStatsInput } from './dto';

@Injectable()
export class RequestsService {
  constructor(private readonly requestsRepository: RequestsRepository) {}

  private normalizeUrl(url: string): string {
    return url.replace(/\/\d+/g, '/:id').replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:id');
  }

  async getStats(orgId: string, input: GetRequestsStatsInput) {
    const stats = await this.requestsRepository.queryStats({ orgId, projectId: input.projectId, from: input.from, to: input.to });
    return {
      data: stats.map((s) => ({
        url: this.normalizeUrl(s.url), method: s.method, count: s.count,
        p50: Math.round(s.p50), p95: Math.round(s.p95), p99: Math.round(s.p99),
        errorRate: Math.round(s.errorRate * 100) / 100,
      })),
    };
  }
}
