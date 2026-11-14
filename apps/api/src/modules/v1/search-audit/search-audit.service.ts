import { Injectable, Logger } from "@nestjs/common";
import type { TenantRequest } from "../../../common/middleware/tenant-context.middleware";
import { auditParams } from "./search-audit.params";
import { SearchAuditRepository } from "./search-audit.repository";

export const MAX_PAGE = 100;

@Injectable()
export class SearchAuditService {
  private readonly logger = new Logger(SearchAuditService.name);

  constructor(private readonly repository: SearchAuditRepository) {}

  record(request: TenantRequest, action: string): void {
    const projectId = (request.params as Record<string, string> | undefined)?.projectId;
    if (!request.orgId || !projectId) return;
    void this.repository
      .insert({
        orgId: request.orgId,
        projectId,
        userId: request.user?.id ?? null,
        actor: request.user?.name || request.user?.email || "api key",
        action,
        params: auditParams(request.query as Record<string, unknown>),
      })
      .catch((error: unknown) => this.logger.warn(`Search audit write failed: ${String(error)}`));
  }

  async list(orgId: string, options: { projectId?: string; before?: number; limit?: number }) {
    const limit = Math.min(Math.max(options.limit ?? 50, 1), MAX_PAGE);
    const rows = await this.repository.list(orgId, { ...options, limit: limit + 1 });
    const page = rows.slice(0, limit);
    return { entries: page, nextBefore: rows.length > limit ? page[page.length - 1]?.id ?? null : null };
  }
}
