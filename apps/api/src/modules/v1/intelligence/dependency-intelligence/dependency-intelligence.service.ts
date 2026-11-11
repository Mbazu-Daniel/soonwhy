import { Injectable } from "@nestjs/common";
import { aggregateDependencyCalls } from "./dependency-aggregator";
import type { DependencyCall, DependencyAggregation } from "./dependency-intelligence.types";

@Injectable()
export class DependencyIntelligenceService {
  aggregateCalls(calls: DependencyCall[]): DependencyAggregation {
    return aggregateDependencyCalls(calls);
  }
}
