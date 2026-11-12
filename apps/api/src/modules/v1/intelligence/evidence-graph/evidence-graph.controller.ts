import {
  Body,
  Controller,
  Delete,
  Get,
  Post,
  Param,
  Query,
} from "@nestjs/common";
import { CurrentOrg, OrgContext } from "../../../../common/decorators/current-org.decorator";
import { EvidenceGraphService } from "./evidence-graph.service";
import type {
  EvidenceEdge,
  EvidenceEdgeType,
  EvidenceNode,
  GraphPath,
  GraphQuery,
  GraphTraversalResult,
} from "./evidence-graph.types";

@Controller("intelligence/evidence-graph")
export class EvidenceGraphController {
  constructor(private readonly graphService: EvidenceGraphService) {}

  @Post("nodes")
  async addNode(
    @CurrentOrg() org: OrgContext,
    @Body() body: { node: EvidenceNode; expiresAt?: string },
  ): Promise<{ success: boolean }> {
    await this.graphService.addNode(
      org.orgId,
      body.node,
      body.expiresAt ? new Date(body.expiresAt) : undefined,
    );
    return { success: true };
  }

  @Post("edges")
  async addEdge(
    @CurrentOrg() org: OrgContext,
    @Body() body: { edge: EvidenceEdge; expiresAt?: string },
  ): Promise<{ success: boolean }> {
    await this.graphService.addEdge(
      org.orgId,
      body.edge,
      body.expiresAt ? new Date(body.expiresAt) : undefined,
    );
    return { success: true };
  }

  @Get("nodes/:nodeId")
  async getNode(
    @CurrentOrg() org: OrgContext,
    @Param("nodeId") nodeId: string,
  ): Promise<EvidenceNode | undefined> {
    return await this.graphService.getNode(org.orgId, nodeId);
  }

  @Get("edges/:edgeId")
  async getEdge(
    @CurrentOrg() org: OrgContext,
    @Param("edgeId") edgeId: string,
  ): Promise<EvidenceEdge | undefined> {
    return await this.graphService.getEdge(org.orgId, edgeId);
  }

  @Post("trace/:traceId")
  async getNodesByTrace(
    @CurrentOrg() org: OrgContext,
    @Param("traceId") traceId: string,
  ) {
    return await this.graphService.getNodesByTrace(org.orgId, traceId);
  }

  @Post("service/:serviceName")
  async getNodesByService(
    @CurrentOrg() org: OrgContext,
    @Param("serviceName") serviceName: string,
  ) {
    return await this.graphService.getNodesByService(org.orgId, serviceName);
  }

  @Post("deployment/:deploymentId")
  async getNodesByDeployment(
    @CurrentOrg() org: OrgContext,
    @Param("deploymentId") deploymentId: string,
  ) {
    return await this.graphService.getNodesByDeployment(org.orgId, deploymentId);
  }

  @Post("find-paths")
  async findPaths(
    @CurrentOrg() org: OrgContext,
    @Body() body: { query: GraphQuery },
  ): Promise<GraphTraversalResult> {
    return await this.graphService.findPaths(org.orgId, body.query);
  }

  @Post("shortest-path")
  async findShortestPath(
    @CurrentOrg() org: OrgContext,
    @Body() body: { startNodeId: string; endNodeId: string; edgeTypes?: EvidenceEdgeType[] },
  ): Promise<GraphPath | null> {
    return this.graphService.findShortestPath(org.orgId, body.startNodeId, body.endNodeId, body.edgeTypes);
  }

  @Get("connected/:nodeId")
  async getConnectedNodes(
    @CurrentOrg() org: OrgContext,
    @Param("nodeId") nodeId: string,
    @Query("depth") depth?: string,
  ) {
    return this.graphService.getConnectedNodes(org.orgId, nodeId, depth ? Number(depth) : 1);
  }

  @Post("connected/:nodeId")
  async getConnectedNodesPost(
    @CurrentOrg() org: OrgContext,
    @Param("nodeId") nodeId: string,
    @Body() body: { depth?: number },
  ) {
    return this.graphService.getConnectedNodes(org.orgId, nodeId, body.depth);
  }

  @Delete("clear")
  async clear(@CurrentOrg() org: OrgContext): Promise<{ success: boolean }> {
    await this.graphService.clear(org.orgId);
    return { success: true };
  }

  @Get("size")
  getSize(@CurrentOrg() org: OrgContext) {
    return this.graphService.getGraphSize(org.orgId);
  }
}
