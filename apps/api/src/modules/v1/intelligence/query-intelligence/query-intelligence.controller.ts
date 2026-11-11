import { Controller, Post, Body } from "@nestjs/common";
import { QueryIntelligenceService } from "./query-intelligence.service";
import type { QueryExecution, QueryAggregation } from "./query-intelligence.types";

@Controller("intelligence/query")
export class QueryIntelligenceController {
  constructor(private readonly service: QueryIntelligenceService) {}

  @Post("normalize")
  normalizeQuery(
    @Body()
    body: {
      query: string;
      databaseSystem?: string;
      orm?: "drizzle" | "prisma" | "typeorm" | "sequelize" | "knex";
    },
  ) {
    return this.service.normalizeQuery(body.query, body.databaseSystem, body.orm);
  }

  @Post("aggregate")
  aggregateExecutions(@Body() body: { executions: QueryExecution[] }) {
    return this.service.aggregateExecutions(body.executions);
  }

  @Post("regression")
  detectRegression(
    @Body()
    body: {
      current: QueryAggregation;
      baseline: QueryAggregation;
      options?: {
        latencyThreshold?: number;
        errorRateThreshold?: number;
        frequencyThreshold?: number;
      };
    },
  ) {
    return this.service.detectRegression(
      body.current,
      body.baseline,
      body.options,
    );
  }

  @Post("n-plus-one")
  detectNPlusOne(
    @Body()
    body: {
      executionsByTrace: Record<string, QueryExecution[]>;
      threshold?: number;
    },
  ) {
    const map = new Map(Object.entries(body.executionsByTrace));
    return this.service.detectNPlusOne(map, body.threshold);
  }

  @Post("large-scan")
  detectLargeScan(
    @Body()
    body: {
      aggregation: QueryAggregation;
      scanEfficiencyThreshold?: number;
    },
  ) {
    return this.service.detectLargeScan(
      body.aggregation,
      body.scanEfficiencyThreshold,
    );
  }
}
