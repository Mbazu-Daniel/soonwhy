import { Injectable, Logger } from "@nestjs/common";
import { Redis } from "ioredis";

@Injectable()
export class EvidenceGraphCache {
  private readonly logger = new Logger(EvidenceGraphCache.name);
  private readonly NODE_TTL = 3600;
  private readonly EDGE_TTL = 3600;
  private readonly TRACE_NODES_TTL = 1800;
  private readonly SERVICE_NODES_TTL = 1800;

  constructor(private readonly redis: Redis) {}

  async cacheNode(organizationId: string, nodeId: string, node: any): Promise<void> {
    const key = this.nodeKey(organizationId, nodeId);
    try {
      await this.redis.setex(key, this.NODE_TTL, JSON.stringify(node));
    } catch (error) {
      this.logger.warn(`Failed to cache node ${nodeId}: ${error}`);
    }
  }

  async getCachedNode(organizationId: string, nodeId: string): Promise<any | null> {
    const key = this.nodeKey(organizationId, nodeId);
    try {
      const cached = await this.redis.get(key);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      this.logger.warn(`Failed to get cached node ${nodeId}: ${error}`);
      return null;
    }
  }

  async cacheEdge(organizationId: string, edgeId: string, edge: any): Promise<void> {
    const key = this.edgeKey(organizationId, edgeId);
    try {
      await this.redis.setex(key, this.EDGE_TTL, JSON.stringify(edge));
    } catch (error) {
      this.logger.warn(`Failed to cache edge ${edgeId}: ${error}`);
    }
  }

  async getCachedEdge(organizationId: string, edgeId: string): Promise<any | null> {
    const key = this.edgeKey(organizationId, edgeId);
    try {
      const cached = await this.redis.get(key);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      this.logger.warn(`Failed to get cached edge ${edgeId}: ${error}`);
      return null;
    }
  }

  async cacheTraceNodes(organizationId: string, traceId: string, nodes: any[]): Promise<void> {
    const key = this.traceNodesKey(organizationId, traceId);
    try {
      await this.redis.setex(key, this.TRACE_NODES_TTL, JSON.stringify(nodes));
    } catch (error) {
      this.logger.warn(`Failed to cache trace nodes for ${traceId}: ${error}`);
    }
  }

  async getCachedTraceNodes(organizationId: string, traceId: string): Promise<any[] | null> {
    const key = this.traceNodesKey(organizationId, traceId);
    try {
      const cached = await this.redis.get(key);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      this.logger.warn(`Failed to get cached trace nodes for ${traceId}: ${error}`);
      return null;
    }
  }

  async cacheServiceNodes(organizationId: string, serviceName: string, nodes: any[]): Promise<void> {
    const key = this.serviceNodesKey(organizationId, serviceName);
    try {
      await this.redis.setex(key, this.SERVICE_NODES_TTL, JSON.stringify(nodes));
    } catch (error) {
      this.logger.warn(`Failed to cache service nodes for ${serviceName}: ${error}`);
    }
  }

  async getCachedServiceNodes(organizationId: string, serviceName: string): Promise<any[] | null> {
    const key = this.serviceNodesKey(organizationId, serviceName);
    try {
      const cached = await this.redis.get(key);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      this.logger.warn(`Failed to get cached service nodes for ${serviceName}: ${error}`);
      return null;
    }
  }

  async invalidateNode(organizationId: string, nodeId: string): Promise<void> {
    const key = this.nodeKey(organizationId, nodeId);
    try {
      await this.redis.del(key);
    } catch (error) {
      this.logger.warn(`Failed to invalidate node ${nodeId}: ${error}`);
    }
  }

  async invalidateEdge(organizationId: string, edgeId: string): Promise<void> {
    const key = this.edgeKey(organizationId, edgeId);
    try {
      await this.redis.del(key);
    } catch (error) {
      this.logger.warn(`Failed to invalidate edge ${edgeId}: ${error}`);
    }
  }

  async invalidateTrace(organizationId: string, traceId: string): Promise<void> {
    const key = this.traceNodesKey(organizationId, traceId);
    try {
      await this.redis.del(key);
    } catch (error) {
      this.logger.warn(`Failed to invalidate trace ${traceId}: ${error}`);
    }
  }

  async invalidateService(organizationId: string, serviceName: string): Promise<void> {
    const key = this.serviceNodesKey(organizationId, serviceName);
    try {
      await this.redis.del(key);
    } catch (error) {
      this.logger.warn(`Failed to invalidate service ${serviceName}: ${error}`);
    }
  }

  async clearOrganization(organizationId: string): Promise<void> {
    const pattern = `evidence:${organizationId}:*`;
    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    } catch (error) {
      this.logger.warn(`Failed to clear organization ${organizationId}: ${error}`);
    }
  }

  async getCacheStats(): Promise<{ nodes: number; edges: number; traces: number; services: number }> {
    try {
      const pattern = "evidence:*";
      const keys = await this.redis.keys(pattern);
      const stats = { nodes: 0, edges: 0, traces: 0, services: 0 };

      for (const key of keys) {
        if (key.includes(":node:")) stats.nodes++;
        else if (key.includes(":edge:")) stats.edges++;
        else if (key.includes(":trace:")) stats.traces++;
        else if (key.includes(":service:")) stats.services++;
      }

      return stats;
    } catch (error) {
      this.logger.warn(`Failed to get cache stats: ${error}`);
      return { nodes: 0, edges: 0, traces: 0, services: 0 };
    }
  }

  private nodeKey(organizationId: string, nodeId: string): string {
    return `evidence:${organizationId}:node:${nodeId}`;
  }

  private edgeKey(organizationId: string, edgeId: string): string {
    return `evidence:${organizationId}:edge:${edgeId}`;
  }

  private traceNodesKey(organizationId: string, traceId: string): string {
    return `evidence:${organizationId}:trace:${traceId}`;
  }

  private serviceNodesKey(organizationId: string, serviceName: string): string {
    return `evidence:${organizationId}:service:${serviceName}`;
  }
}
