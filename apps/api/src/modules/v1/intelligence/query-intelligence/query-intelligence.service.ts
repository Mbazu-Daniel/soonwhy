import { Injectable } from "@nestjs/common";
import {
  normalizeQuery,
  normalizeOrmQuery,
} from "./sql-normalizer";
import {
  aggregateQueryExecutions,
  detectNPlusOnePattern,
  detectLargeScanPattern,
} from "./query-aggregator";
import { detectQueryRegression } from "./query-regression-detector";
import type {
  QueryExecution,
  QueryAggregation,
  QueryRegression,
  NPlusOnePattern,
  LargeScanPattern,
} from "./query-intelligence.types";

@Injectable()
export class QueryIntelligenceService {
  normalizeQuery(
    query: string,
    databaseSystem?: string,
    orm?: "drizzle" | "prisma" | "typeorm" | "sequelize" | "knex",
  ) {
    if (orm) {
      return normalizeOrmQuery(query, orm);
    }
    return normalizeQuery(query, databaseSystem);
  }

  aggregateExecutions(executions: QueryExecution[]): QueryAggregation {
    return aggregateQueryExecutions(executions);
  }

  detectRegression(
    current: QueryAggregation,
    baseline: QueryAggregation,
    options?: {
      latencyThreshold?: number;
      errorRateThreshold?: number;
      frequencyThreshold?: number;
    },
  ): QueryRegression | undefined {
    return detectQueryRegression(
      current,
      baseline,
      options?.latencyThreshold,
      options?.errorRateThreshold,
      options?.frequencyThreshold,
    );
  }

  detectNPlusOne(
    executionsByTrace: Map<string, QueryExecution[]>,
    threshold?: number,
  ): NPlusOnePattern[] {
    return detectNPlusOnePattern(executionsByTrace, threshold);
  }

  detectLargeScan(
    aggregation: QueryAggregation,
    scanEfficiencyThreshold?: number,
  ): LargeScanPattern | undefined {
    return detectLargeScanPattern(aggregation, scanEfficiencyThreshold);
  }
}
