import { Injectable, Optional } from "@nestjs/common";
import { and, eq, lt } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type { TelemetryIdentity } from "@soonwhy/shared";
import { db } from "../../../../common/db";
import { evidenceEdges, evidenceNodes } from "../../../../common/db/schema";
import type {
  EvidenceEdge,
  EvidenceEdgeType,
  EvidenceNode,
  EvidenceNodeType,
} from "./evidence-graph.types";

@Injectable()
export class EvidenceGraphRepository {
  private readonly db: PostgresJsDatabase<any>;

  constructor(@Optional() customDb?: PostgresJsDatabase<any>) {
    this.db = customDb ?? db;
  }

  async addNode(
    organizationId: string,
    node: EvidenceNode,
    expiresAt?: Date,
  ): Promise<void> {
    await this.db.insert(evidenceNodes).values({
      organizationId,
      nodeId: node.id,
      nodeType: node.type,
      identity: node.identity,
      data: node.data,
      timestamp: new Date(node.timestamp),
      traceId: node.identity.resourceName,
      serviceName: node.identity.serviceName,
      deploymentId: node.data.deploymentId as string | undefined,
      expiresAt,
    });
  }

  async getNode(
    organizationId: string,
    nodeId: string,
  ): Promise<EvidenceNode | null> {
    const result = await this.db
      .select()
      .from(evidenceNodes)
      .where(
        and(
          eq(evidenceNodes.organizationId, organizationId),
          eq(evidenceNodes.nodeId, nodeId),
        ),
      )
      .limit(1);

    const row = result[0];
    if (!row) return null;

    return {
      id: row.nodeId,
      type: row.nodeType as EvidenceNodeType,
      identity: row.identity as TelemetryIdentity,
      data: (row.data ?? {}) as Record<string, unknown>,
      timestamp: row.timestamp.toISOString(),
    };
  }

  async addEdge(
    organizationId: string,
    edge: EvidenceEdge,
    expiresAt?: Date,
  ): Promise<void> {
    await this.db.insert(evidenceEdges).values({
      organizationId,
      edgeId: edge.id,
      sourceNodeId: edge.sourceId,
      targetNodeId: edge.targetId,
      edgeType: edge.type,
      strength: edge.strength.toString(),
      metadata: edge.metadata,
      expiresAt,
    });
  }

  async getEdge(
    organizationId: string,
    edgeId: string,
  ): Promise<EvidenceEdge | null> {
    const result = await this.db
      .select()
      .from(evidenceEdges)
      .where(
        and(
          eq(evidenceEdges.organizationId, organizationId),
          eq(evidenceEdges.edgeId, edgeId),
        ),
      )
      .limit(1);

    const row = result[0];
    if (!row) return null;

    return {
      id: row.edgeId,
      sourceId: row.sourceNodeId,
      targetId: row.targetNodeId,
      type: row.edgeType as EvidenceEdgeType,
      strength: parseFloat(row.strength),
      metadata: row.metadata as Record<string, unknown> | undefined,
    };
  }

  async getNodesByTrace(
    organizationId: string,
    traceId: string,
  ): Promise<EvidenceNode[]> {
    const results = await this.db
      .select()
      .from(evidenceNodes)
      .where(
        and(
          eq(evidenceNodes.organizationId, organizationId),
          eq(evidenceNodes.traceId, traceId),
        ),
      );

    return results.map((row) => ({
      id: row.nodeId,
      type: row.nodeType as EvidenceNodeType,
      identity: row.identity as TelemetryIdentity,
      data: (row.data ?? {}) as Record<string, unknown>,
      timestamp: row.timestamp.toISOString(),
    }));
  }

  async getNodesByService(
    organizationId: string,
    serviceName: string,
  ): Promise<EvidenceNode[]> {
    const results = await this.db
      .select()
      .from(evidenceNodes)
      .where(
        and(
          eq(evidenceNodes.organizationId, organizationId),
          eq(evidenceNodes.serviceName, serviceName),
        ),
      );

    return results.map((row) => ({
      id: row.nodeId,
      type: row.nodeType as EvidenceNodeType,
      identity: row.identity as TelemetryIdentity,
      data: (row.data ?? {}) as Record<string, unknown>,
      timestamp: row.timestamp.toISOString(),
    }));
  }

  async getNodesByDeployment(
    organizationId: string,
    deploymentId: string,
  ): Promise<EvidenceNode[]> {
    const results = await this.db
      .select()
      .from(evidenceNodes)
      .where(
        and(
          eq(evidenceNodes.organizationId, organizationId),
          eq(evidenceNodes.deploymentId, deploymentId),
        ),
      );

    return results.map((row) => ({
      id: row.nodeId,
      type: row.nodeType as EvidenceNodeType,
      identity: row.identity as TelemetryIdentity,
      data: (row.data ?? {}) as Record<string, unknown>,
      timestamp: row.timestamp.toISOString(),
    }));
  }

  async getOutgoingEdges(
    organizationId: string,
    sourceNodeId: string,
  ): Promise<EvidenceEdge[]> {
    const results = await this.db
      .select()
      .from(evidenceEdges)
      .where(
        and(
          eq(evidenceEdges.organizationId, organizationId),
          eq(evidenceEdges.sourceNodeId, sourceNodeId),
        ),
      );

    return results.map((row) => ({
      id: row.edgeId,
      sourceId: row.sourceNodeId,
      targetId: row.targetNodeId,
      type: row.edgeType as EvidenceEdgeType,
      strength: parseFloat(row.strength),
      metadata: row.metadata as Record<string, unknown> | undefined,
    }));
  }

  async getIncomingEdges(
    organizationId: string,
    targetNodeId: string,
  ): Promise<EvidenceEdge[]> {
    const results = await this.db
      .select()
      .from(evidenceEdges)
      .where(
        and(
          eq(evidenceEdges.organizationId, organizationId),
          eq(evidenceEdges.targetNodeId, targetNodeId),
        ),
      );

    return results.map((row) => ({
      id: row.edgeId,
      sourceId: row.sourceNodeId,
      targetId: row.targetNodeId,
      type: row.edgeType as EvidenceEdgeType,
      strength: parseFloat(row.strength),
      metadata: row.metadata as Record<string, unknown> | undefined,
    }));
  }

  async deleteExpiredNodes(): Promise<number> {
    const now = new Date();
    const result = await this.db
      .delete(evidenceNodes)
      .where(lt(evidenceNodes.expiresAt, now))
      .returning();
    return result.length;
  }

  async deleteExpiredEdges(): Promise<number> {
    const now = new Date();
    const result = await this.db
      .delete(evidenceEdges)
      .where(lt(evidenceEdges.expiresAt, now))
      .returning();
    return result.length;
  }
}
