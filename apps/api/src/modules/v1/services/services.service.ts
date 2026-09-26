import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { QUICKWIT_INDEXES, QuickwitService } from '@soonwhy/shared';
import { quickwitTenantQuery } from '../../../common/quickwit/query';
import { ServicesRepository } from './services.repository';
import { CreateServiceInput } from './dto';

interface TraceSpanSource {
  service?: string;
  spanId?: string;
  parentSpanId?: string;
}

@Injectable()
export class ServicesService {
  constructor(
    private readonly servicesRepository: ServicesRepository,
    private readonly quickwit: QuickwitService,
  ) {}

  async getServiceMap(projectId: string, orgId: string) {
    const result = await this.quickwit.search<TraceSpanSource>(QUICKWIT_INDEXES.traces, {
      query: quickwitTenantQuery(orgId, projectId),
      startTimestamp: Math.floor((Date.now() - 86_400_000) / 1000),
      endTimestamp: Math.floor(Date.now() / 1000),
      maxHits: 5000,
    });
    const spans = result.hits.flatMap((hit) => (hit._source ? [hit._source] : []));
    return buildServiceMap(spans);
  }

  async getServiceById(id: string, orgId: string) {
    const svc = await this.servicesRepository.getServiceById(id, orgId);
    if (!svc) throw new NotFoundException('Service not found');
    return svc;
  }

  async getServicesForProject(projectId: string, orgId: string) {
    return this.servicesRepository.getServicesByProjectId(projectId, orgId);
  }

  async createService(projectId: string, orgId: string, input: CreateServiceInput) {
    const existing = await this.servicesRepository.getServiceByProjectAndSlug(projectId, orgId, input.slug);
    if (existing) throw new ConflictException('Service slug already exists in this project');

    return this.servicesRepository.createService({ projectId, orgId, ...input });
  }

  async deleteService(id: string, orgId: string) {
    await this.getServiceById(id, orgId);
    return this.servicesRepository.deleteService(id);
  }
}

export function buildServiceMap(spans: TraceSpanSource[]) {
  const serviceBySpanId = new Map<string, string>();
  const nodeCounts = new Map<string, number>();
  const edgeCounts = new Map<string, number>();

  for (const span of spans) {
    const service = span.service || 'unknown';
    if (span.spanId) serviceBySpanId.set(span.spanId, service);
    nodeCounts.set(service, (nodeCounts.get(service) ?? 0) + 1);
  }

  for (const span of spans) {
    if (!span.parentSpanId) continue;
    const source = serviceBySpanId.get(span.parentSpanId);
    const target = span.service || 'unknown';
    if (!source || source === target) continue;
    const key = `${source}\0${target}`;
    edgeCounts.set(key, (edgeCounts.get(key) ?? 0) + 1);
  }

  return {
    nodes: [...nodeCounts.entries()]
      .map(([service, requests]) => ({ service, requests }))
      .sort((a, b) => b.requests - a.requests),
    edges: [...edgeCounts.entries()]
      .map(([key, requests]) => {
        const [source, target] = key.split('\0');
        return { source: source!, target: target!, requests };
      })
      .sort((a, b) => b.requests - a.requests),
  };
}
