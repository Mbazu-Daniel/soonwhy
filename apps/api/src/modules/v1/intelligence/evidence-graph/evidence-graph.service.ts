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

function createEmptyGraph(): EvidenceGraph {
  return {
    nodes: new Map(),
    edges: new Map(),
    indexedByTrace: new Map(),
    indexedByService: new Map(),
    indexedByDeployment: new Map(),
  };
}

@Injectable()
export class EvidenceGraphService {
  private readonly graphs = new Map<string, EvidenceGraph>();

  constructor(
    @Optional() private readonly repository?: EvidenceGraphRepository,
    @Optional() private readonly cache?: EvidenceGraphCache,
  ) {}

  private graphFor(organizationId: string): EvidenceGraph {
    let graph = this.graphs.get(organizationId);
    if (!graph) {
      graph = createEmptyGraph();
      this.graphs.set(organizationId, graph);
    }
    return graph;
  }

  async addNode(organizationId: string, node: EvidenceNode, expiresAt?: Date): Promise<void> {
    const graph = this.graphFor(organizationId);
    graph.nodes.set(node.id, node);

    if (node.identity.resourceName) {
      const traceId = node.identity.resourceName;
      const nodes = graph.indexedByTrace.get(traceId) || new Set();
      nodes.add(node.id);
      graph.indexedByTrace.set(traceId, nodes);
    }

    if (node.identity.serviceName) {
      const serviceName = node.identity.serviceName;
      const nodes = graph.indexedByService.get(serviceName) || new Set();
      nodes.add(node.id);
      graph.indexedByService.set(serviceName, nodes);
    }

    const deploymentId = node.data.deploymentId as string | undefined;
    if (deploymentId) {
      const nodes = graph.indexedByDeployment.get(deploymentId) || new Set();
      nodes.add(node.id);
      graph.indexedByDeployment.set(deploymentId, nodes);
    }

    if (this.cache) {
      await this.cache.cacheNode(organizationId, node.id, node);
    }

    if (this.repository) {
      await this.repository.addNode(organizationId, node, expiresAt);
    }
  }

  async addNodesBatch(organizationId: string, nodes: EvidenceNode[], expiresAt?: Date): Promise<void> {
    const batchSize = 100;
    for (let i = 0; i < nodes.length; i += batchSize) {
      const batch = nodes.slice(i, i + batchSize);
      await Promise.all(batch.map((node) => this.addNode(organizationId, node, expiresAt)));
    }
  }

  async addEdge(organizationId: string, edge: EvidenceEdge, expiresAt?: Date): Promise<void> {
    const graph = this.graphFor(organizationId);
    graph.edges.set(edge.id, edge);

    if (this.cache) {
      await this.cache.cacheEdge(organizationId, edge.id, edge);
    }

    if (this.repository) {
      await this.repository.addEdge(organizationId, edge, expiresAt);
    }
  }

  async getNode(organizationId: string, nodeId: string): Promise<EvidenceNode | undefined> {
    const graph = this.graphFor(organizationId);
    const local = graph.nodes.get(nodeId);
    if (local) {
      return local;
    }

    if (this.cache) {
      const cached = await this.cache.getCachedNode(organizationId, nodeId);
      if (cached) {
        graph.nodes.set(nodeId, cached);
        return cached;
      }
    }

    if (this.repository) {
      const result = await this.repository.getNode(organizationId, nodeId);
      if (result) {
        graph.nodes.set(nodeId, result);
        if (this.cache) {
          await this.cache.cacheNode(organizationId, nodeId, result);
        }
        return result;
      }
    }

    return undefined;
  }

  async getEdge(organizationId: string, edgeId: string): Promise<EvidenceEdge | undefined> {
    const graph = this.graphFor(organizationId);
    const local = graph.edges.get(edgeId);
    if (local) {
      return local;
    }

    if (this.cache) {
      const cached = await this.cache.getCachedEdge(organizationId, edgeId);
      if (cached) {
        graph.edges.set(edgeId, cached);
        return cached;
      }
    }

    if (this.repository) {
      const result = await this.repository.getEdge(organizationId, edgeId);
      if (result) {
        graph.edges.set(edgeId, result);
        if (this.cache) {
          await this.cache.cacheEdge(organizationId, edgeId, result);
        }
        return result;
      }
    }

    return undefined;
  }

  async getNodesByTrace(organizationId: string, traceId: string): Promise<EvidenceNode[]> {
    const graph = this.graphFor(organizationId);
    const nodeIds = graph.indexedByTrace.get(traceId);
    if (nodeIds && nodeIds.size > 0) {
      return this.nodesFromIds(graph, nodeIds);
    }

    if (this.cache) {
      const cached = await this.cache.getCachedTraceNodes(organizationId, traceId);
      if (cached) {
        for (const node of cached) {
          graph.nodes.set(node.id, node);
        }
        return cached;
      }
    }

    if (this.repository) {
      const nodes = await this.repository.getNodesByTrace(organizationId, traceId);
      for (const node of nodes) {
        graph.nodes.set(node.id, node);
      }
      if (this.cache && nodes.length > 0) {
        await this.cache.cacheTraceNodes(organizationId, traceId, nodes);
      }
      return nodes;
    }

    return [];
  }

  async getNodesByService(organizationId: string, serviceName: string): Promise<EvidenceNode[]> {
    const graph = this.graphFor(organizationId);
    const nodeIds = graph.indexedByService.get(serviceName);
    if (nodeIds && nodeIds.size > 0) {
      return this.nodesFromIds(graph, nodeIds);
    }

    if (this.cache) {
      const cached = await this.cache.getCachedServiceNodes(organizationId, serviceName);
      if (cached) {
        for (const node of cached) {
          graph.nodes.set(node.id, node);
        }
        return cached;
      }
    }

    if (this.repository) {
      const nodes = await this.repository.getNodesByService(organizationId, serviceName);
      for (const node of nodes) {
        graph.nodes.set(node.id, node);
      }
      if (this.cache && nodes.length > 0) {
        await this.cache.cacheServiceNodes(organizationId, serviceName, nodes);
      }
      return nodes;
    }

    return [];
  }

  async getNodesByDeployment(organizationId: string, deploymentId: string): Promise<EvidenceNode[]> {
    const graph = this.graphFor(organizationId);
    const nodeIds = graph.indexedByDeployment.get(deploymentId);
    if (nodeIds && nodeIds.size > 0) {
      return this.nodesFromIds(graph, nodeIds);
    }

    if (this.repository) {
      const nodes = await this.repository.getNodesByDeployment(organizationId, deploymentId);
      for (const node of nodes) {
        graph.nodes.set(node.id, node);
      }
      return nodes;
    }

    return [];
  }

  async findPaths(organizationId: string, query: GraphQuery): Promise<GraphTraversalResult> {
    const graph = this.graphFor(organizationId);
    const visitedNodes = new Set<string>();
    const paths: GraphPath[] = [];

    const startNodes = this.resolveStartNodes(graph, query);
    if (startNodes.length === 0) {
      return { paths, visitedNodes, totalPaths: 0 };
    }

    for (const startNode of startNodes) {
      this.traverse(
        graph,
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
    organizationId: string,
    startNodeId: string,
    endNodeId: string,
    edgeTypes?: EvidenceEdgeType[],
  ): Promise<GraphPath | null> {
    const graph = this.graphFor(organizationId);
    const startNode = graph.nodes.get(startNodeId);
    const endNode = graph.nodes.get(endNodeId);

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

      const outgoingEdges = this.getOutgoingEdgesFrom(graph, nodeId, edgeTypes);
      for (const edge of outgoingEdges) {
        if (visited.has(edge.targetId)) continue;
        visited.add(edge.targetId);

        const targetNode = graph.nodes.get(edge.targetId);
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

  getOutgoingEdges(organizationId: string, nodeId: string, edgeTypes?: EvidenceEdgeType[]): EvidenceEdge[] {
    return this.getOutgoingEdgesFrom(this.graphFor(organizationId), nodeId, edgeTypes);
  }

  getIncomingEdges(organizationId: string, nodeId: string, edgeTypes?: EvidenceEdgeType[]): EvidenceEdge[] {
    const edges: EvidenceEdge[] = [];

    for (const edge of this.graphFor(organizationId).edges.values()) {
      if (edge.targetId !== nodeId) continue;
      if (edgeTypes && !edgeTypes.includes(edge.type)) continue;
      edges.push(edge);
    }

    return edges;
  }

  getConnectedNodes(organizationId: string, nodeId: string, depth: number = 1): EvidenceNode[] {
    const graph = this.graphFor(organizationId);
    const visited = new Set<string>([nodeId]);
    const result: EvidenceNode[] = [];

    const queue: { nodeId: string; currentDepth: number }[] = [
      { nodeId, currentDepth: 0 },
    ];

    while (queue.length > 0) {
      const { nodeId: currentId, currentDepth } = queue.shift()!;

      if (currentDepth >= depth) continue;

      for (const edge of this.getOutgoingEdgesFrom(graph, currentId)) {
        if (visited.has(edge.targetId)) continue;
        visited.add(edge.targetId);

        const targetNode = graph.nodes.get(edge.targetId);
        if (targetNode) {
          result.push(targetNode);
          queue.push({ nodeId: edge.targetId, currentDepth: currentDepth + 1 });
        }
      }

      for (const edge of this.getIncomingEdges(organizationId, currentId)) {
        if (visited.has(edge.sourceId)) continue;
        visited.add(edge.sourceId);

        const sourceNode = graph.nodes.get(edge.sourceId);
        if (sourceNode) {
          result.push(sourceNode);
          queue.push({ nodeId: edge.sourceId, currentDepth: currentDepth + 1 });
        }
      }
    }

    return result;
  }

  async clear(organizationId: string): Promise<void> {
    this.graphs.delete(organizationId);
  }

  getGraphSize(organizationId: string): { nodes: number; edges: number } {
    const graph = this.graphFor(organizationId);
    return {
      nodes: graph.nodes.size,
      edges: graph.edges.size,
    };
  }

  async getCacheStats(): Promise<{ nodes: number; edges: number; traces: number; services: number } | null> {
    if (!this.cache) return null;
    return await this.cache.getCacheStats();
  }

  private nodesFromIds(graph: EvidenceGraph, nodeIds: Set<string>): EvidenceNode[] {
    const nodes: EvidenceNode[] = [];
    for (const nodeId of nodeIds) {
      const node = graph.nodes.get(nodeId);
      if (node) nodes.push(node);
    }
    return nodes;
  }

  private getOutgoingEdgesFrom(
    graph: EvidenceGraph,
    nodeId: string,
    edgeTypes?: EvidenceEdgeType[],
  ): EvidenceEdge[] {
    const edges: EvidenceEdge[] = [];

    for (const edge of graph.edges.values()) {
      if (edge.sourceId !== nodeId) continue;
      if (edgeTypes && !edgeTypes.includes(edge.type)) continue;
      edges.push(edge);
    }

    return edges;
  }

  private resolveStartNodes(graph: EvidenceGraph, query: GraphQuery): EvidenceNode[] {
    if (query.startNodeId) {
      const node = graph.nodes.get(query.startNodeId);
      return node ? [node] : [];
    }

    if (query.startType) {
      const nodes: EvidenceNode[] = [];
      for (const node of graph.nodes.values()) {
        if (node.type === query.startType) {
          nodes.push(node);
        }
      }
      return nodes;
    }

    return Array.from(graph.nodes.values());
  }

  private traverse(
    graph: EvidenceGraph,
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

    for (const edge of this.getOutgoingEdgesFrom(graph, currentNode.id, query.edgeTypes)) {
      if (query.minStrength !== undefined && edge.strength < query.minStrength) {
        continue;
      }

      if (visited.has(edge.targetId)) continue;

      const targetNode = graph.nodes.get(edge.targetId);
      if (!targetNode) continue;

      const newPath: GraphPath = {
        nodes: [...currentPath.nodes, targetNode],
        edges: [...currentPath.edges, edge],
        totalStrength: currentPath.totalStrength * edge.strength,
      };

      this.traverse(graph, targetNode, query, visited, newPath, results, currentDepth + 1);
    }
  }
}
