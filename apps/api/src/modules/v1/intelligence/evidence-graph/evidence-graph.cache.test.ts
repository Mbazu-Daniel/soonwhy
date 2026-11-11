import { describe, expect, it, beforeEach, vi } from "vitest";
import { EvidenceGraphCache } from "./evidence-graph.cache";
import { Redis } from "ioredis";

describe("EvidenceGraphCache", () => {
  let cache: EvidenceGraphCache;
  let mockRedis: any;

  beforeEach(() => {
    mockRedis = {
      setex: vi.fn().mockResolvedValue("OK"),
      get: vi.fn().mockResolvedValue(null),
      del: vi.fn().mockResolvedValue(1),
      keys: vi.fn().mockResolvedValue([]),
    };

    cache = new EvidenceGraphCache(mockRedis);
  });

  describe("cacheNode", () => {
    it("caches a node", async () => {
      const node = { id: "node-1", type: "service" };

      await cache.cacheNode("org-1", "node-1", node);

      expect(mockRedis.setex).toHaveBeenCalledWith(
        "evidence:org-1:node:node-1",
        3600,
        JSON.stringify(node),
      );
    });

    it("handles cache errors gracefully", async () => {
      mockRedis.setex.mockRejectedValue(new Error("Redis error"));

      await expect(cache.cacheNode("org-1", "node-1", {})).resolves.not.toThrow();
    });
  });

  describe("getCachedNode", () => {
    it("returns null when node not cached", async () => {
      const result = await cache.getCachedNode("org-1", "node-1");

      expect(result).toBeNull();
    });

    it("returns cached node", async () => {
      const node = { id: "node-1", type: "service" };
      mockRedis.get.mockResolvedValue(JSON.stringify(node));

      const result = await cache.getCachedNode("org-1", "node-1");

      expect(result).toEqual(node);
    });

    it("handles parse errors gracefully", async () => {
      mockRedis.get.mockResolvedValue("invalid json");

      const result = await cache.getCachedNode("org-1", "node-1");

      expect(result).toBeNull();
    });
  });

  describe("cacheEdge", () => {
    it("caches an edge", async () => {
      const edge = { id: "edge-1", sourceId: "node-1", targetId: "node-2" };

      await cache.cacheEdge("org-1", "edge-1", edge);

      expect(mockRedis.setex).toHaveBeenCalledWith(
        "evidence:org-1:edge:edge-1",
        3600,
        JSON.stringify(edge),
      );
    });
  });

  describe("getCachedEdge", () => {
    it("returns null when edge not cached", async () => {
      const result = await cache.getCachedEdge("org-1", "edge-1");

      expect(result).toBeNull();
    });
  });

  describe("cacheTraceNodes", () => {
    it("caches trace nodes", async () => {
      const nodes = [{ id: "node-1" }, { id: "node-2" }];

      await cache.cacheTraceNodes("org-1", "trace-123", nodes);

      expect(mockRedis.setex).toHaveBeenCalledWith(
        "evidence:org-1:trace:trace-123",
        1800,
        JSON.stringify(nodes),
      );
    });
  });

  describe("getCachedTraceNodes", () => {
    it("returns null when trace nodes not cached", async () => {
      const result = await cache.getCachedTraceNodes("org-1", "trace-123");

      expect(result).toBeNull();
    });
  });

  describe("cacheServiceNodes", () => {
    it("caches service nodes", async () => {
      const nodes = [{ id: "node-1" }];

      await cache.cacheServiceNodes("org-1", "checkout", nodes);

      expect(mockRedis.setex).toHaveBeenCalledWith(
        "evidence:org-1:service:checkout",
        1800,
        JSON.stringify(nodes),
      );
    });
  });

  describe("getCachedServiceNodes", () => {
    it("returns null when service nodes not cached", async () => {
      const result = await cache.getCachedServiceNodes("org-1", "checkout");

      expect(result).toBeNull();
    });
  });

  describe("invalidateNode", () => {
    it("invalidates a node", async () => {
      await cache.invalidateNode("org-1", "node-1");

      expect(mockRedis.del).toHaveBeenCalledWith("evidence:org-1:node:node-1");
    });
  });

  describe("invalidateEdge", () => {
    it("invalidates an edge", async () => {
      await cache.invalidateEdge("org-1", "edge-1");

      expect(mockRedis.del).toHaveBeenCalledWith("evidence:org-1:edge:edge-1");
    });
  });

  describe("invalidateTrace", () => {
    it("invalidates a trace", async () => {
      await cache.invalidateTrace("org-1", "trace-123");

      expect(mockRedis.del).toHaveBeenCalledWith("evidence:org-1:trace:trace-123");
    });
  });

  describe("invalidateService", () => {
    it("invalidates a service", async () => {
      await cache.invalidateService("org-1", "checkout");

      expect(mockRedis.del).toHaveBeenCalledWith("evidence:org-1:service:checkout");
    });
  });

  describe("clearOrganization", () => {
    it("clears all organization keys", async () => {
      mockRedis.keys.mockResolvedValue([
        "evidence:org-1:node:node-1",
        "evidence:org-1:edge:edge-1",
      ]);

      await cache.clearOrganization("org-1");

      expect(mockRedis.del).toHaveBeenCalledWith(
        "evidence:org-1:node:node-1",
        "evidence:org-1:edge:edge-1",
      );
    });

    it("handles empty keys gracefully", async () => {
      mockRedis.keys.mockResolvedValue([]);

      await cache.clearOrganization("org-1");

      expect(mockRedis.del).not.toHaveBeenCalled();
    });
  });

  describe("getCacheStats", () => {
    it("returns cache statistics", async () => {
      mockRedis.keys.mockResolvedValue([
        "evidence:org-1:node:node-1",
        "evidence:org-1:edge:edge-1",
        "evidence:org-1:trace:trace-123",
        "evidence:org-1:service:checkout",
      ]);

      const stats = await cache.getCacheStats();

      expect(stats).toEqual({
        nodes: 1,
        edges: 1,
        traces: 1,
        services: 1,
      });
    });

    it("handles errors gracefully", async () => {
      mockRedis.keys.mockRejectedValue(new Error("Redis error"));

      const stats = await cache.getCacheStats();

      expect(stats).toEqual({ nodes: 0, edges: 0, traces: 0, services: 0 });
    });
  });
});
