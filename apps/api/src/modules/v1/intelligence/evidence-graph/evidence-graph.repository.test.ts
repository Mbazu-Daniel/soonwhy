import { describe, expect, it, beforeEach, vi } from "vitest";
import { EvidenceGraphRepository } from "./evidence-graph.repository";
import type { EvidenceNode, EvidenceEdge } from "./evidence-graph.types";

describe("EvidenceGraphRepository", () => {
  let repository: EvidenceGraphRepository;
  let mockDb: any;

  beforeEach(() => {
    mockDb = {
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
    };

    repository = new EvidenceGraphRepository(mockDb);
  });

  describe("addNode", () => {
    it("inserts node into database", async () => {
      const node: EvidenceNode = {
        id: "node-1",
        type: "service",
        identity: { domain: "performance", fingerprint: "abc", fingerprintVersion: 1 },
        data: {},
        timestamp: new Date().toISOString(),
      };

      await repository.addNode("org-1", node);

      expect(mockDb.insert).toHaveBeenCalled();
      expect(mockDb.values).toHaveBeenCalled();
    });
  });

  describe("getNode", () => {
    it("returns null when node not found", async () => {
      mockDb.limit.mockResolvedValue([]);

      const result = await repository.getNode("org-1", "node-1");

      expect(result).toBeNull();
    });

    it("returns node when found", async () => {
      const mockNode = {
        nodeId: "node-1",
        nodeType: "service",
        identity: { domain: "performance" },
        data: {},
        timestamp: new Date(),
      };
      mockDb.limit.mockResolvedValue([mockNode]);

      const result = await repository.getNode("org-1", "node-1");

      expect(result).toBeDefined();
      expect(result?.id).toBe("node-1");
    });
  });

  describe("deleteExpiredNodes", () => {
    it("deletes nodes past expiration", async () => {
      mockDb.where.mockReturnValue({ returning: vi.fn().mockResolvedValue([{}, {}]) });

      const count = await repository.deleteExpiredNodes();

      expect(count).toBe(2);
    });
  });
});
