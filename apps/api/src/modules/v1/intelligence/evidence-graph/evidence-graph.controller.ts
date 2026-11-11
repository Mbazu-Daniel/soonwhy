import { Controller, Post, Get, Body, Param } from "@nestjs/common";
import { EvidenceGraphService } from "./evidence-graph.service";
import type {
  EvidenceNode,
  EvidenceEdge,
  GraphPath,
  GraphQuery,
  GraphTraversalResult,
} from "./evidence-graph.types";

@Controller("intelligence/evidence-graph")
export class EvidenceGraphController {
  constructor(private readonly graphService: EvidenceGraphService) {}

  @Post("nodes")
  async addNode(@Body() body: { organizationId: string; node: EvidenceNode; expiresAt?: string }): Promise<{ success: boolean }> {
    await this.graphService.addNode(body.organizationId, body.node, body.expiresAt ? new Date(body.expiresAt) : undefined);
    return { success: true };
  }

  @Post("edges")
  async addEdge(@Body() body: { organizationId: string; edge: EvidenceEdge; expiresAt?: string }): Promise<{ success: boolean }> {
    await this.graphService.addEdge(body.organizationId, body.edge, body.expiresAt ? new Date(body.expiresAt) : undefined);
    return { success: true };
  }

  @Get("nodes/:nodeId")
  async getNode(@Param("nodeId") nodeId: string, @Body() body: { organizationId: string }): Promise<EvidenceNode | undefined> {
    return await this.graphService.getNode(body.organizationId, nodeId);
  }

  @Get("edges/:edgeId")
  async getEdge(@Param("edgeId") edgeId: string, @Body() body: { organizationId: string }): Promise<EvidenceEdge | undefined> {
    return await this.graphService.getEdge(body.organizationId, edgeId);
  }

  @Post("trace/:traceId")
  async getNodesByTrace(@Param("traceId") traceId: string, @Body() body: { organizationId: string }) {
    return await this.graphService.getNodesByTrace(body.organizationId, traceId);
  }

  @Post("service/:serviceName")
  async getNodesByService(@Param("serviceName") serviceName: string, @Body() body: { organizationId: string }) {
    return await this.graphService.getNodesByService(body.organizationId, serviceName);
  }

  @Post("deployment/:deploymentId")
  async getNodesByDeployment(@Param("deploymentId") deploymentId: string, @Body() body: { organizationId: string }) {
    return await this.graphService.getNodesByDeployment(body.organizationId, deploymentId);
  }

  @Post("find-paths")
  async findPaths(@Body() body: { organizationId: string; query: GraphQuery }): Promise<GraphTraversalResult> {
    return await this.graphService.findPaths(body.query);
  }

  @Post("shortest-path")
  async findShortestPath(
    @Body()
    body: {
      organizationId: string;
      startNodeId: string;
      endNodeId: string;
      edgeTypes?: string[];
    },
  ): Promise<GraphPath | null> {
    return await this.graphService.findShortestPath(
      body.startNodeId,
      body.endNodeId,
      body.edgeTypes as any,
    );
  }

  @Get("connected/:nodeId")
  async getConnectedNodes(
    @Param("nodeId") nodeId: string,
    @Body() body: { organizationId: string; depth?: number },
  ) {
    return this.graphService.getConnectedNodes(nodeId, body.depth);
  }

  @Post("connected/:nodeId")
  async getConnectedNodesPost(
    @Param("nodeId") nodeId: string,
    @Body() body: { organizationId: string; depth?: number },
  ) {
    return this.graphService.getConnectedNodes(nodeId, body.depth);
  }

  @Post("clear")
  async clear(): Promise<{ success: boolean }> {
    await this.graphService.clear();
    return { success: true };
  }

  @Get("size")
  getSize() {
    return this.graphService.getGraphSize();
  }
}
