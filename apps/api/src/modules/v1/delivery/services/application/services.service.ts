import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { QuickwitService } from "@soonwhy/shared";
import { quickwitSource } from "../../../../../common/quickwit/query";
import { ServicesRepository } from "../infrastructure/services.repository";
import { CreateServiceInput, UpdateServiceInput } from "../domain/dto";
import { observedServiceNames } from "../domain/observed-services";
import { serviceSlug, uniqueSlug } from "../domain/service-slug";
import { LANGUAGE_RECHECK_MS, MAX_LANGUAGE_CHECKS, MAX_OBSERVED_SERVICES, MAX_SYNC_ROUNDS, SYNC_INTERVAL_MS } from "../domain/service-sync.constants";
import { searchTenant } from "../../../../../common/telemetry/tenant-search";
import { servicesSeenWithin, telemetryStateOf } from "../domain/service-activity";
import { type TelemetryState } from "../domain/service-activity.types";
import { ACTIVE_WINDOW_MS, STALE_WINDOW_MS } from "../domain/service-activity.constants";
import { detectServiceLanguage } from "../domain/service-language";

const FAILURE_RETRY_MS = 60_000;

interface TraceSpanSource {
  service?: string;
  spanId?: string;
  parentSpanId?: string;
}

@Injectable()
export class ServicesService {
  private readonly logger = new Logger(ServicesService.name);
  private readonly lastSync = new Map<string, number>();
  private readonly lastFailure = new Map<string, number>();
  private readonly inFlight = new Map<string, Promise<void>>();
  private readonly languageChecked = new Map<string, number>();

  constructor(
    private readonly servicesRepository: ServicesRepository,
    private readonly quickwit: QuickwitService,
  ) {}

  private async syncObservedServices(projectId: string, orgId: string): Promise<void> {
    const key = `${orgId}:${projectId}`;
    const running = this.inFlight.get(key);
    if (running) return running;
    if (Date.now() - (this.lastSync.get(key) ?? 0) < SYNC_INTERVAL_MS) return;
    const failedAt = this.lastFailure.get(key);
    if (failedAt && Date.now() - failedAt < FAILURE_RETRY_MS) return;
    const task = (async () => {
      let succeeded = false;
      try {
        const existing = await this.servicesRepository.getServicesByProjectId(projectId, orgId);
        const names = new Set(existing.map((svc) => svc.name));
        const slugs = new Set(existing.map((svc) => svc.slug));
        for (let round = 0; round < MAX_SYNC_ROUNDS; round += 1) {
          const observed = await observedServiceNames(this.quickwit, orgId, projectId, [...names]);
          const fresh = observed.filter((name) => !names.has(name));
          for (const name of fresh) {
            const slug = uniqueSlug(serviceSlug(name), slugs);
            names.add(name);
            slugs.add(slug);
            await this.servicesRepository.createService({ projectId, orgId, name, slug });
          }
          if (observed.length < MAX_OBSERVED_SERVICES || !fresh.length) break;
        }
        succeeded = true;
      } catch (error) {
        this.lastFailure.set(key, Date.now());
        this.logger.warn(
          `Observed-service sync failed for ${orgId}/${projectId}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      } finally {
        if (succeeded) {
          this.lastSync.set(key, Date.now());
          this.lastFailure.delete(key);
        }
        this.inFlight.delete(key);
      }
    })();
    this.inFlight.set(key, task);
    return task;
  }

  async getServiceMap(projectId: string, orgId: string) {
    const result = await searchTenant<TraceSpanSource>(this.quickwit, "traces", { orgId, projectId }, {
        startTimestamp: Math.floor((Date.now() - 86_400_000) / 1000),
        endTimestamp: Math.floor(Date.now() / 1000),
        maxHits: 5000,
      },
    );
    return buildServiceMap(
      result.hits.flatMap((hit) => {
        const source = quickwitSource<TraceSpanSource>(hit);
        return source ? [source] : [];
      }),
    );
  }

  async getServiceById(publicId: string, projectId: string, orgId: string) {
    const svc = await this.servicesRepository.getServiceById(
      publicId,
      projectId,
      orgId,
    );
    if (!svc) throw new NotFoundException("Service not found");
    return toPublicService(svc);
  }

  async getServicesForProject(projectId: string, orgId: string) {
    await this.syncObservedServices(projectId, orgId);
    const services = await this.servicesRepository.getServicesByProjectId(projectId, orgId);
    const withLanguage = await this.fillLanguages(projectId, orgId, services);
    return this.withTelemetryState(projectId, orgId, withLanguage);
  }

  private async withTelemetryState<T extends { name: string }>(
    projectId: string,
    orgId: string,
    services: T[],
  ): Promise<Array<T & { telemetry: TelemetryState | null }>> {
    if (!services.length) return [];
    try {
      const [active, recent] = await Promise.all([
        servicesSeenWithin(this.quickwit, orgId, projectId, ACTIVE_WINDOW_MS),
        servicesSeenWithin(this.quickwit, orgId, projectId, STALE_WINDOW_MS),
      ]);
      return services.map((svc) => ({ ...svc, telemetry: telemetryStateOf(svc.name, active, recent) }));
    } catch {
      return services.map((svc) => ({ ...svc, telemetry: null }));
    }
  }

  private async fillLanguages<T extends { id: string; name: string; language: string | null }>(
    projectId: string,
    orgId: string,
    services: T[],
  ): Promise<T[]> {
    const now = Date.now();
    const pending = services
      .filter((svc) => !svc.language && now - (this.languageChecked.get(svc.id) ?? 0) > LANGUAGE_RECHECK_MS)
      .slice(0, MAX_LANGUAGE_CHECKS);
    const found = new Map<string, string>();
    await Promise.all(
      pending.map(async (svc) => {
        this.languageChecked.set(svc.id, now);
        try {
          const language = await detectServiceLanguage(this.quickwit, orgId, projectId, svc.name);
          if (!language) return;
          await this.servicesRepository.updateService(svc.id, orgId, { language });
          found.set(svc.id, language);
        } catch {
          return;
        }
      }),
    );
    return services.map((svc) => (found.has(svc.id) ? { ...svc, language: found.get(svc.id)! } : svc));
  }

  async createService(
    projectId: string,
    orgId: string,
    input: CreateServiceInput,
  ) {
    const existing = await this.servicesRepository.getServiceByProjectAndSlug(
      projectId,
      orgId,
      input.slug,
    );
    if (existing)
      throw new ConflictException(
        "Service slug already exists in this project",
      );
    const created = await this.servicesRepository.createService({
      projectId,
      orgId,
      ...input,
    });
    if (!created) {
      throw new ConflictException(
        "Service slug already exists in this project",
      );
    }
    return { ...created, id: created.publicId ?? created.id };
  }

  async updateService(
    publicId: string,
    projectId: string,
    orgId: string,
    input: UpdateServiceInput,
  ) {
    const existing = await this.servicesRepository.getServiceById(
      publicId,
      projectId,
      orgId,
    );
    if (!existing) throw new NotFoundException("Service not found");
    const changes = Object.fromEntries(
      Object.entries(input).filter(([, value]) => value !== undefined),
    ) as Record<string, string | null>;
    if (!Object.keys(changes).length) return toPublicService(existing);
    await this.servicesRepository.updateService(existing.id, orgId, changes);
    const updated = await this.servicesRepository.getServiceById(
      publicId,
      projectId,
      orgId,
    );
    if (!updated) throw new NotFoundException("Service not found");
    return toPublicService(updated);
  }

  async deleteService(publicId: string, projectId: string, orgId: string) {
    const existing = await this.servicesRepository.getServiceById(
      publicId,
      projectId,
      orgId,
    );
    if (!existing) throw new NotFoundException("Service not found");
    return this.servicesRepository.deleteService(existing.id, orgId);
  }
}

function toPublicService<T extends { id: string; publicId?: string | null }>(svc: T) {
  return { ...svc, id: svc.publicId ?? svc.id };
}

export function buildServiceMap(spans: TraceSpanSource[]) {
  const serviceBySpanId = new Map<string, string>();
  const nodeCounts = new Map<string, number>();
  const edgeCounts = new Map<string, number>();
  for (const span of spans) {
    const service = span.service || "unknown";
    if (span.spanId) serviceBySpanId.set(span.spanId, service);
    nodeCounts.set(service, (nodeCounts.get(service) ?? 0) + 1);
  }
  for (const span of spans) {
    if (!span.parentSpanId) continue;
    const source = serviceBySpanId.get(span.parentSpanId);
    const target = span.service || "unknown";
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
        const [source, target] = key.split("\0");
        return { source: source!, target: target!, requests };
      })
      .sort((a, b) => b.requests - a.requests),
  };
}
