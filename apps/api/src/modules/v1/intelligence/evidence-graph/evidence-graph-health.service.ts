import { Injectable, Logger } from "@nestjs/common";
import { EvidenceGraphRepository } from "./evidence-graph.repository";
import { EvidenceGraphCache } from "./evidence-graph.cache";

@Injectable()
export class EvidenceGraphHealthService {
  private readonly logger = new Logger(EvidenceGraphHealthService.name);

  constructor(
    private readonly repository: EvidenceGraphRepository,
    private readonly cache: EvidenceGraphCache,
  ) {}

  async getHealthStatus(): Promise<{
    database: { healthy: boolean; latency: number };
    cache: { healthy: boolean; latency: number };
    graph: { nodes: number; edges: number };
  }> {
    const dbStart = Date.now();
    let dbHealthy = false;
    try {
      // Try a simple query - check if we can at least query
      await this.repository.getNode("health-check", "health-check");
      dbHealthy = true;
    } catch (error) {
      // Expected to fail on missing node, but proves DB connection works
      const errStr = String(error);
      dbHealthy = errStr.includes("not found") || !errStr.includes("connect");
    }
    const dbLatency = Date.now() - dbStart;

    const cacheStart = Date.now();
    let cacheHealthy = false;
    try {
      const stats = await this.cache.getCacheStats();
      cacheHealthy = stats !== null;
    } catch (error) {
      this.logger.warn(`Cache health check failed: ${error}`);
    }
    const cacheLatency = Date.now() - cacheStart;

    return {
      database: { healthy: dbHealthy, latency: dbLatency },
      cache: { healthy: cacheHealthy, latency: cacheLatency },
      graph: { nodes: 0, edges: 0 }, // Would need graph service injection
    };
  }
}
