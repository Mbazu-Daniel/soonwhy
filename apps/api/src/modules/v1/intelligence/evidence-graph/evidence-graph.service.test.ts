import { describe, expect, it, beforeEach } from "vitest";
import { EvidenceGraphService } from "./evidence-graph.service";
import type { EvidenceNode, EvidenceEdge } from "./evidence-graph.types";

describe("EvidenceGraphService", () => {
  let service: EvidenceGraphService;

  beforeEach(() => {
    service = new EvidenceGraphService();
    service.clear();
  });

  describe("node management", () => {
    it("adds and retrieves nodes", async () => {
      const node: EvidenceNode = {
        id: "node-1",
        type: "service",
        identity: {
          domain: "performance",
          fingerprint: "abc123",
          fingerprintVersion: 1,
          serviceName: "checkout",
        },
        data: { name: "checkout-service" },
        timestamp: new Date().toISOString(),
      };

      await service.addNode("org-1", node);
      const retrieved = await service.getNode("org-1", "node-1");

      expect(retrieved).toEqual(node);
    });

    it("indexes nodes by trace", async () => {
      const node: EvidenceNode = {
        id: "node-1",
        type: "trace",
        identity: {
          domain: "trace",
          fingerprint: "abc123",
          fingerprintVersion: 1,
          resourceName: "trace-123",
        },
        data: {},
        timestamp: new Date().toISOString(),
      };

      await service.addNode("org-1", node);
      const traceNodes = await service.getNodesByTrace("org-1", "trace-123");

      expect(traceNodes).toHaveLength(1);
      expect(traceNodes[0]?.id).toBe("node-1");
    });

    it("indexes nodes by service", async () => {
      const node: EvidenceNode = {
        id: "node-1",
        type: "service",
        identity: {
          domain: "performance",
          fingerprint: "abc123",
          fingerprintVersion: 1,
          serviceName: "checkout",
        },
        data: {},
        timestamp: new Date().toISOString(),
      };

      await service.addNode("org-1", node);
      const serviceNodes = await service.getNodesByService("org-1", "checkout");

      expect(serviceNodes).toHaveLength(1);
      expect(serviceNodes[0]?.id).toBe("node-1");
    });
  });

  describe("edge management", () => {
    it("adds and retrieves edges", async () => {
      const edge: EvidenceEdge = {
        id: "edge-1",
        sourceId: "node-1",
        targetId: "node-2",
        type: "causes",
        strength: 0.9,
      };

      await service.addEdge("org-1", edge);
      const retrieved = await service.getEdge("org-1", "edge-1");

      expect(retrieved).toEqual(edge);
    });
  });

  describe("path finding", () => {
    it("finds shortest path between nodes", async () => {
      const node1: EvidenceNode = {
        id: "node-1",
        type: "service",
        identity: { domain: "performance", fingerprint: "a", fingerprintVersion: 1 },
        data: {},
        timestamp: new Date().toISOString(),
      };
      const node2: EvidenceNode = {
        id: "node-2",
        type: "trace",
        identity: { domain: "trace", fingerprint: "b", fingerprintVersion: 1 },
        data: {},
        timestamp: new Date().toISOString(),
      };
      const node3: EvidenceNode = {
        id: "node-3",
        type: "error",
        identity: { domain: "error", fingerprint: "c", fingerprintVersion: 1 },
        data: {},
        timestamp: new Date().toISOString(),
      };

      await service.addNode("org-1", node1);
      await service.addNode("org-1", node2);
      await service.addNode("org-1", node3);

      await service.addEdge("org-1", {
        id: "edge-1",
        sourceId: "node-1",
        targetId: "node-2",
        type: "causes",
        strength: 0.8,
      });
      await service.addEdge("org-1", {
        id: "edge-2",
        sourceId: "node-2",
        targetId: "node-3",
        type: "causes",
        strength: 0.9,
      });

      const path = await service.findShortestPath("node-1", "node-3");

      expect(path).not.toBeNull();
      expect(path?.nodes).toHaveLength(3);
      expect(path?.nodes[0]?.id).toBe("node-1");
      expect(path?.nodes[2]?.id).toBe("node-3");
    });

    it("returns null when no path exists", async () => {
      const node1: EvidenceNode = {
        id: "node-1",
        type: "service",
        identity: { domain: "performance", fingerprint: "a", fingerprintVersion: 1 },
        data: {},
        timestamp: new Date().toISOString(),
      };
      const node2: EvidenceNode = {
        id: "node-2",
        type: "service",
        identity: { domain: "performance", fingerprint: "b", fingerprintVersion: 1 },
        data: {},
        timestamp: new Date().toISOString(),
      };

      await service.addNode("org-1", node1);
      await service.addNode("org-1", node2);

      const path = await service.findShortestPath("node-1", "node-2");

      expect(path).toBeNull();
    });
  });

  describe("connected nodes", () => {
    it("finds connected nodes within depth", async () => {
      const node1: EvidenceNode = {
        id: "node-1",
        type: "service",
        identity: { domain: "performance", fingerprint: "a", fingerprintVersion: 1 },
        data: {},
        timestamp: new Date().toISOString(),
      };
      const node2: EvidenceNode = {
        id: "node-2",
        type: "trace",
        identity: { domain: "trace", fingerprint: "b", fingerprintVersion: 1 },
        data: {},
        timestamp: new Date().toISOString(),
      };
      const node3: EvidenceNode = {
        id: "node-3",
        type: "error",
        identity: { domain: "error", fingerprint: "c", fingerprintVersion: 1 },
        data: {},
        timestamp: new Date().toISOString(),
      };

      await service.addNode("org-1", node1);
      await service.addNode("org-1", node2);
      await service.addNode("org-1", node3);

      await service.addEdge("org-1", {
        id: "edge-1",
        sourceId: "node-1",
        targetId: "node-2",
        type: "causes",
        strength: 0.8,
      });
      await service.addEdge("org-1", {
        id: "edge-2",
        sourceId: "node-2",
        targetId: "node-3",
        type: "causes",
        strength: 0.9,
      });

      const connected = service.getConnectedNodes("node-1", 2);

      expect(connected).toHaveLength(2);
      expect(connected.map((n) => n.id)).toContain("node-2");
      expect(connected.map((n) => n.id)).toContain("node-3");
    });
  });

  describe("graph management", () => {
    it("reports graph size", async () => {
      const node: EvidenceNode = {
        id: "node-1",
        type: "service",
        identity: { domain: "performance", fingerprint: "a", fingerprintVersion: 1 },
        data: {},
        timestamp: new Date().toISOString(),
      };

      await service.addNode("org-1", node);
      await service.addEdge("org-1", {
        id: "edge-1",
        sourceId: "node-1",
        targetId: "node-1",
        type: "causes",
        strength: 1,
      });

      const size = service.getGraphSize();

      expect(size.nodes).toBe(1);
      expect(size.edges).toBe(1);
    });

    it("clears the graph", async () => {
      const node: EvidenceNode = {
        id: "node-1",
        type: "service",
        identity: { domain: "performance", fingerprint: "a", fingerprintVersion: 1 },
        data: {},
        timestamp: new Date().toISOString(),
      };

      await service.addNode("org-1", node);
      await service.clear();

      const size = service.getGraphSize();

      expect(size.nodes).toBe(0);
      expect(size.edges).toBe(0);
    });
  });
});
