import { Injectable } from "@nestjs/common";
import { quickwitTerm } from "../../../../../common/quickwit/query";
import { TelemetryQueryService } from "../../../../../common/telemetry";
import { ERROR_SPAN_FILTER, REQUEST_SPAN_FILTER } from "../../../../../common/telemetry/span-filters";
import {
  DEPENDENCY_SPAN_FILTER,
  LATENCY_PERCENTS,
  MAX_DEPENDENCIES,
  MAX_OPERATIONS,
} from "../domain/service-operations.constants";
import { buildDependencies, buildOperations, failingOperations } from "../domain/service-operations";
import type { ServiceOperations, TermBuckets } from "../domain/service-operations.types";

interface Scope {
  orgId: string;
  projectId: string;
  service: string;
  from?: string;
  to?: string;
}

@Injectable()
export class ServiceOperationsService {
  constructor(private readonly telemetryQuery: TelemetryQueryService) {}

  private async grouped(scope: Scope, spanFilter: string, field: string, size: number, withType: boolean) {
    const range = this.telemetryQuery.range(scope.from, scope.to);
    const base = {
      orgId: scope.orgId,
      projectId: scope.projectId,
      from: range.from,
      to: range.to,
    };
    const filters = [quickwitTerm("service", scope.service), spanFilter];
    const terms = { terms: { field, size } };
    const [all, failed] = await Promise.all([
      this.telemetryQuery.search<never>("traces", { ...base, filters }, {
        maxHits: 0,
        aggregations: {
          groups: {
            ...terms,
            aggs: {
              avg: { avg: { field: "duration" } },
              latency: { percentiles: { field: "duration", percents: LATENCY_PERCENTS } },
              ...(withType ? { type: { terms: { field: "dependencyType", size: 1 } } } : {}),
            },
          },
        },
      }),
      this.telemetryQuery.search<never>("traces", { ...base, filters: [...filters, ERROR_SPAN_FILTER] }, {
        maxHits: 0,
        aggregations: { groups: terms },
      }),
    ]);
    return {
      all: all.aggregations?.groups as TermBuckets | undefined,
      failed: failed.aggregations?.groups as TermBuckets | undefined,
    };
  }

  async forService(scope: Scope): Promise<ServiceOperations> {
    const [requests, dependencies] = await Promise.all([
      this.grouped(scope, REQUEST_SPAN_FILTER, "name", MAX_OPERATIONS, false),
      this.grouped(scope, DEPENDENCY_SPAN_FILTER, "dependencyName", MAX_DEPENDENCIES, true),
    ]);
    const operations = buildOperations(requests.all, requests.failed);
    return {
      service: scope.service,
      operations,
      dependencies: buildDependencies(dependencies.all, dependencies.failed),
      failing: failingOperations(operations),
    };
  }
}
