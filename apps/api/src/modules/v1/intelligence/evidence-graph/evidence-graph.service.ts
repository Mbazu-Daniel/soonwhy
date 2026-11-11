import { Injectable, Optional } from "@nestjs/common";
import type {
  EvidenceNode,
  EvidenceEdge,
  EvidenceGraph,
  GraphPath,
  GraphQuery,
  GraphTraversalResult,
  EvidenceEdgeType,
} from "./evidence-graph.types";
import { EvidenceGraphRepository } from "./evidence-graph.repository";
import { EvidenceGraphCache } from "./evidence-graph.cache";

@Injectable()
export class EvidenceGraphService {
  private inMemoryGraph: EvidenceGraph = {
    nodes: new Map(),
    edges: new Map(),
    indexedByTrace: new Map(),
    indexedByService: new Map(),
    indexedByDeployment: new Map(),
  };

  constructor(
    @Optional() private readonly repository?: EvidenceGraphRepository,
    @Optional() private readonly cache?: EvidenceGraphCache,
  ) {}

  async addNode(organizationId: string, node: EvidenceNode, expiresAt?: Date): Promise<void> {
    // Store in in-memory for fast access
    this.inMemoryGraph.nodes.set(node.id, node);

    // Index by trace
    if (node.identity.resourceName) {
      const traceId = node.identity.resourceName;
      const nodes = this.inMemoryGraph.indexedByTrace.get(traceId) || new Set();
      nodes.add(node.id);
      this.inMemoryGraph.indexedByTrace.set(traceId, nodes);
    }

    // Index by service
    if (node.identity.serviceName) {
      const serviceName = node.identity.serviceName;
      const nodes = this.inMemoryGraph.indexedByService.get(serviceName) || new Set();
      nodes.add(node.id);
      this.inMemoryGraph.indexedByService.set(serviceName, nodes);
    }

    // Index by deployment
    const deploymentId = node.data.deploymentId as string | undefined;
    if (deploymentId) {
      const nodes = this.inMemoryGraph.indexedByDeployment.get(deploymentId) || new Set();
      nodes.add(node.id);
      this.inMemoryGraph.indexedByDeployment.set(deploymentId, nodes);
    }

    // Cache the node
    if (this.cache) {
      await this.cache.cacheNode(organizationId, node.id, node);
    }

    // Persist to database if repository available
    if (this.repository) {
      await this.repository.addNode(organizationId, node, expiresAt);
    }
  }

  async addNodesBatch(organizationId: string, nodes: EvidenceNode[], expiresAt?: Date): Promise<void> {
    // Process in batches for performance
    const batchSize = 100;
    for (let i = 0; i < nodes.length; i += batchSize) {
      const batch = nodes.slice(i, i + batchSize);
      await Promise.all(batch.map((node) => this.addNode(organizationId, node, expiresAt)));
    }
  }

  async addEdge(organizationId: string, edge: EvidenceEdge, expiresAt?: Date): Promise<void> {
    this.inMemoryGraph.edges.set(edge.id, edge);

    if (this.cache) {
      await this.cache.cacheEdge(organizationId, edge.id, edge);
    }

    if (this.repository) {
      await this.repository.addEdge(organizationId, edge, expiresAt);
    }
  }

  async getNode(organizationId: string, nodeId: string): Promise<EvidenceNode | undefined> {
    // Check in-memory first
    if (this.inMemoryGraph.nodes.has(nodeId)) {
      return this.inMemoryGraph.nodes.get(nodeId);
    }

    // Check cache
    if (this.cache) {
      const cached = await this.cache.getCachedNode(organizationId, nodeId);
      if (cached) {
        this.inMemoryGraph.nodes.set(nodeId, cached);
        return cached;
      }
    }

    // Fallback to database
    if (this.repository) {
      const result = await this.repository.getNode(organizationId, nodeId);
      if (result) {
        this.inMemoryGraph.nodes.set(nodeId, result);
        if (this.cache) {
          await this.cache.cacheNode(organizationId, nodeId, result);
        }
        return result;
      }
    }

    return undefined;
  }

  async getEdge(organizationId: string, edgeId: string): Promise<EvidenceEdge | undefined> {
    if (this.inMemoryGraph.edges.has(edgeId)) {
      return this.inMemoryGraph.edges.get(edgeId);
    }

    if (this.cache) {
      const cached = await this.cache.getCachedEdge(organizationId, edgeId);
      if (cached) {
        this.inMemoryGraph.edges.set(edgeId, cached);
        return cached;
      }
    }

    if (this.repository) {
      const result = await this.repository.getEdge(organizationId, edgeId);
      if (result) {
        this.inMemoryGraph.edges.set(edgeId, result);
        if (this.cache) {
          await this.cache.cacheEdge(organizationId, edgeId, result);
        }
        return result;
      }
    }

    return undefined;
  }

  async getNodesByTrace(organizationId: string, traceId: string): Promise<EvidenceNode[]> {
    const nodeIds = this.inMemoryGraph.indexedByTrace.get(traceId);
    if (nodeIds && nodeIds.size > 0) {
      const nodes: EvidenceNode[] = [];
      for (const nodeId of nodeIds) {
        const node = this.inMemoryGraph.nodes.get(nodeId);
        if (node) nodes.push(node);
      }
      return nodes;
    }

    if (this.cache) {
      const cached = await this.cache.getCachedTraceNodes(organizationId, traceId);
      if (cached) {
        for (const node of cached) {
          this.inMemoryGraph.nodes.set(node.id, node);
        }
        return cached;
      }
    }

    if (this.repository) {
      const nodes = await this.repository.getNodesByTrace(organizationId, traceId);
      for (const node of nodes) {
        this.inMemoryGraph.nodes.set(node.id, node);
      }
      if (this.cache && nodes.length > 0) {
        await this.cache.cacheTraceNodes(organizationId, traceId, nodes);
      }
      return nodes;
    }

    return [];
  }

  async getNodesByService(organizationId: string, serviceName: string): Promise<EvidenceNode[]> {
    const nodeIds = this.inMemoryGraph.indexedByService.get(serviceName);
    if (nodeIds && nodeIds.size > 0) {
      const nodes: EvidenceNode[] = [];
      for (const nodeId of nodeIds) {
        const node = this.inMemoryGraph.nodes.get(nodeId);
        if (node) nodes.push(node);
      }
      return nodes;
    }

    if (this.cache) {
      const cached = await this.cache.getCachedServiceNodes(organizationId, serviceName);
      if (cached) {
        for (const node of cached) {
          this.inMemoryGraph.nodes.set(node.id, node);
        }
        return cached;
      }
    }

    if (this.repository) {
      const nodes = await this.repository.getNodesByService(organizationId, serviceName);
      for (const node of nodes) {
        this.inMemoryGraph.nodes.set(node.id, node);
      }
      if (this.cache && nodes.length > 0) {
        await this.cache.cacheServiceNodes(organizationId, serviceName, nodes);
      }
      return nodes;
    }

    return [];
  }

  async getNodesByDeployment(organizationId: string, deploymentId: string): Promise<EvidenceNode[]> {
    const nodeIds = this.inMemoryGraph.indexedByDeployment.get(deploymentId);
    if (nodeIds && nodeIds.size > 0) {
      const nodes: EvidenceNode[] = [];
      for (const nodeId of nodeIds) {
        const node = this.inMemoryGraph.nodes.get(nodeId);
        if (node) nodes.push(node);
      }
      return nodes;
    }

    if (this.repository) {
      const nodes = await this.repository.getNodesByDeployment(organizationId, deploymentId);
      for (const node of nodes) {
        this.inMemoryGraph.nodes.set(node.id, node);
      }
      return nodes;
    }

    return [];
  }

  async findPaths(query: GraphQuery): Promise<GraphTraversalResult> {
    const visitedNodes = new Set<string>();
    const paths: GraphPath[] = [];

    const startNodes = this.resolveStartNodes(query);
    if (startNodes.length === 0) {
      return { paths, visitedNodes, totalPaths: 0 };
    }

    for (const startNode of startNodes) {
      this.traverse(
        startNode,
        query,
        visitedNodes,
        { nodes: [startNode], edges: [], totalStrength: 1 },
        paths,
        0,
      );
    }

    return {
      paths,
      visitedNodes,
      totalPaths: paths.length,
    };
  }

  async findShortestPath(
    startNodeId: string,
    endNodeId: string,
    edgeTypes?: EvidenceEdgeType[],
  ): Promise<GraphPath | null> {
    const startNode = this.inMemoryGraph.nodes.get(startNodeId);
    const endNode = this.inMemoryGraph.nodes.get(endNodeId);

    if (!startNode || !endNode) return null;

    const queue: { nodeId: string; path: GraphPath }[] = [
      {
        nodeId: startNodeId,
        path: { nodes: [startNode], edges: [], totalStrength: 1 },
      },
    ];
    const visited = new Set<string>([startNodeId]);

    while (queue.length > 0) {
      const { nodeId, path } = queue.shift()!;

      if (nodeId === endNodeId) {
        return path;
      }

      const outgoingEdges = this.getOutgoingEdges(nodeId, edgeTypes);
      for (const edge of outgoingEdges) {
        if (visited.has(edge.targetId)) continue;
        visited.add(edge.targetId);

        const targetNode = this.inMemoryGraph.nodes.get(edge.targetId);
        if (!targetNode) continue;

        const newPath: GraphPath = {
          nodes: [...path.nodes, targetNode],
          edges: [...path.edges, edge],
          totalStrength: path.totalStrength * edge.strength,
        };

        queue.push({ nodeId: edge.targetId, path: newPath });
      }
    }

    return null;
  }

  getOutgoingEdges(nodeId: string, edgeTypes?: EvidenceEdgeType[]): EvidenceEdge[] {
    const edges: EvidenceEdge[] = [];

    for (const edge of this.inMemoryGraph.edges.values()) {
      if (edge.sourceId !== nodeId) continue;
      if (edgeTypes && !edgeTypes.includes(edge.type)) continue;
      edges.push(edge);
    }

    return edges;
  }

  getIncomingEdges(nodeId: string, edgeTypes?: EvidenceEdgeType[]): EvidenceEdge[] {
    const edges: EvidenceEdge[] = [];

    for (const edge of this.inMemoryGraph.edges.values()) {
      if (edge.targetId !== nodeId) continue;
      if (edgeTypes && !edgeTypes.includes(edge.type)) continue;
      edges.push(edge);
    }

    return edges;
  }

  getConnectedNodes(nodeId: string, depth: number = 1): EvidenceNode[] {
    const visited = new Set<string>([nodeId]);
    const result: EvidenceNode[] = [];

    const queue: { nodeId: string; currentDepth: number }[] = [
      { nodeId, currentDepth: 0 },
    ];

    while (queue.length > 0) {
      const { nodeId: currentId, currentDepth } = queue.shift()!;

      if (currentDepth >= depth) continue;

      const outgoingEdges = this.getOutgoingEdges(currentId);
      for (const edge of outgoingEdges) {
        if (visited.has(edge.targetId)) continue;
        visited.add(edge.targetId);

        const targetNode = this.inMemoryGraph.nodes.get(edge.targetId);
        if (targetNode) {
          result.push(targetNode);
          queue.push({ nodeId: edge.targetId, currentDepth: currentDepth + 1 });
        }
      }

      const incomingEdges = this.getIncomingEdges(currentId);
      for (const edge of incomingEdges) {
        if (visited.has(edge.sourceId)) continue;
        visited.add(edge.sourceId);

        const sourceNode = this.inMemoryGraph.nodes.get(edge.sourceId);
        if (sourceNode) {
          result.push(sourceNode);
          queue.push({ nodeId: edge.sourceId, currentDepth: currentDepth + 1 });
        }
      }
    }

    return result;
  }

  async clear(): Promise<void> {
    this.inMemoryGraph = {
      nodes: new Map(),
      edges: new Map(),
      indexedByTrace: new Map(),
      indexedByService: new Map(),
      indexedByDeployment: new Map(),
    };

    // Note: We don't clear the database to preserve audit trail
    // Expired data is cleaned up by a scheduled job
  }

  getGraphSize(): { nodes: number; edges: number } {
    return {
      nodes: this.inMemoryGraph.nodes.size,
      edges: this.inMemoryGraph.edges.size,
    };
  }

  async getCacheStats(): Promise<{ nodes: number; edges: number; traces: number; services: number } | null> {
    if (!this.cache) return null;
    return await this.cache.getCacheStats();
  }

  private resolveStartNodes(query: GraphQuery): EvidenceNode[] {
    if (query.startNodeId) {
      const node = this.inMemoryGraph.nodes.get(query.startNodeId);
      return node ? [node] : [];
    }

    if (query.startType) {
      const nodes: EvidenceNode[] = [];
      for (const node of this.inMemoryGraph.nodes.values()) {
        if (node.type === query.startType) {
          nodes.push(node);
        }
      }
      return nodes;
    }

    return Array.from(this.inMemoryGraph.nodes.values());
  }

  private traverse(
    currentNode: EvidenceNode,
    query: GraphQuery,
    visited: Set<string>,
    currentPath: GraphPath,
    results: GraphPath[],
    currentDepth: number,
  ): void {
    visited.add(currentNode.id);

    if (query.endNodeId && currentNode.id === query.endNodeId) {
      results.push(currentPath);
      return;
    }

    if (query.endType && currentNode.type === query.endType) {
      results.push(currentPath);
      return;
    }

    if (query.maxDepth !== undefined && currentDepth >= query.maxDepth) {
      return;
    }

    const outgoingEdges = this.getOutgoingEdges(currentNode.id, query.edgeTypes);
    for (const edge of outgoingEdges) {
      if (query.minStrength !== undefined && edge.strength < query.minStrength) {
        continue;
      }

      if (visited.has(edge.targetId)) continue;

      const targetNode = this.inMemoryGraph.nodes.get(edge.targetId);
      if (!targetNode) continue;

      const newPath: GraphPath = {
        nodes: [...currentPath.nodes, targetNode],
        edges: [...currentPath.edges, edge],
        totalStrength: currentPath.totalStrength * edge.strength,
      };

      this.traverse(targetNode, query, visited, newPath, results, currentDepth + 1);
    }
  }
}
