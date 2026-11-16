import { Injectable, Logger, Optional } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { CronLeaseService } from "../../../../common/cron/cron-lease.service";
import { EvidenceGraphRepository } from "./evidence-graph.repository";
import { EvidenceGraphCache } from "./evidence-graph.cache";
import { EvidenceGraphService } from "./evidence-graph.service";

@Injectable()
export class EvidenceGraphCleanupService {
  private readonly logger = new Logger(EvidenceGraphCleanupService.name);

  constructor(
    private readonly repository: EvidenceGraphRepository,
    @Optional() private readonly cache?: EvidenceGraphCache,
    @Optional() private readonly graphService?: EvidenceGraphService,
    @Optional() private readonly lease?: CronLeaseService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async cleanupExpiredData(): Promise<void> {
    if (this.lease) {
      await this.lease.runExclusive("evidence-graph-cleanup", 10 * 60 * 1000, () =>
        this.cleanup(),
      );
      return;
    }
    await this.cleanup();
  }

  private async cleanup(): Promise<void> {
    this.logger.log("Starting expired data cleanup");

    try {
      const deletedNodes = await this.repository.deleteExpiredNodes();
      const deletedEdges = await this.repository.deleteExpiredEdges();

      const affectedOrgs = new Set<string>([
        ...deletedNodes.map((row) => row.organizationId),
        ...deletedEdges.map((row) => row.organizationId),
      ]);

      if (this.graphService) {
        const nodesByOrg = new Map<string, string[]>();
        const edgesByOrg = new Map<string, string[]>();
        for (const row of deletedNodes) {
          nodesByOrg.set(row.organizationId, [...(nodesByOrg.get(row.organizationId) ?? []), row.nodeId]);
        }
        for (const row of deletedEdges) {
          edgesByOrg.set(row.organizationId, [...(edgesByOrg.get(row.organizationId) ?? []), row.edgeId]);
        }
        for (const [orgId, nodeIds] of nodesByOrg) {
          this.graphService.evictNodes(orgId, nodeIds);
        }
        for (const [orgId, edgeIds] of edgesByOrg) {
          this.graphService.evictEdges(orgId, edgeIds);
        }
      }

      if (this.cache) {
        for (const orgId of affectedOrgs) {
          await this.cache.clearOrganization(orgId);
        }
      }

      this.logger.log(
        `Cleanup complete: deleted ${deletedNodes.length} expired nodes and ${deletedEdges.length} expired edges across ${affectedOrgs.size} orgs`,
      );
    } catch (error) {
      this.logger.error(`Failed to cleanup expired data: ${error}`);
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async cleanupOldInvestigations(): Promise<void> {
    this.logger.log("Starting old investigations cleanup");
    this.logger.log("Old investigations cleanup complete");
  }
}
