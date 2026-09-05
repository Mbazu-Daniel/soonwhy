import { Injectable } from '@nestjs/common';
import { MetricsRepository } from './metrics.repository';
import { GetMetricsInput } from './dto';
import { chRange } from '../../../common/clickhouse/ch-time';

@Injectable()
export class MetricsService {
  constructor(private readonly metricsRepository: MetricsRepository) {}

  async getMetrics(orgId: string, input: GetMetricsInput) {
    const { from, to } = chRange(input.from, input.to);

    const buckets = await this.metricsRepository.queryMetrics({
      orgId,
      projectId: input.projectId,
      from,
      to,
      interval: input.interval,
      service: input.service || '',
    });

    return {
      buckets: buckets.map((b) => ({
        bucket: b.bucket,
        count: b.count,
        p50: Math.round(b.p50),
        p95: Math.round(b.p95),
        p99: Math.round(b.p99),
        statusCodes: {
          _2xx: b._2xx,
          _3xx: b._3xx,
          _4xx: b._4xx,
          _5xx: b._5xx,
        },
      })),
    };
  }
}
