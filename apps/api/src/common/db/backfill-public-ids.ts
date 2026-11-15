import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
} from "@nestjs/common";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "./index";
import { generatePublicId, isPublicIdCollision } from "./public-id";
import { invitations, investigationCases, services } from "./schema";

@Injectable()
export class PublicIdBackfillService implements OnApplicationBootstrap {
  private readonly logger = new Logger(PublicIdBackfillService.name);

  async onApplicationBootstrap() {
    try {
      const investigations = await this.backfillInvestigations();
      const backfilledServices = await this.backfillServices();
      const backfilledInvitations = await this.backfillInvitations();
      const total = investigations + backfilledServices + backfilledInvitations;
      if (total > 0) {
        this.logger.log(`Assigned public ids to ${total} existing rows`);
      }
    } catch (error) {
      this.logger.warn(
        `Public id backfill skipped: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private async backfillInvestigations() {
    const rows = await db
      .select({ id: investigationCases.id })
      .from(investigationCases)
      .where(isNull(investigationCases.publicId));
    for (const row of rows) {
      await this.assign((publicId) =>
        db
          .update(investigationCases)
          .set({ publicId })
          .where(and(eq(investigationCases.id, row.id), isNull(investigationCases.publicId))),
      );
    }
    return rows.length;
  }

  private async backfillServices() {
    const rows = await db
      .select({ id: services.id })
      .from(services)
      .where(isNull(services.publicId));
    for (const row of rows) {
      await this.assign((publicId) =>
        db
          .update(services)
          .set({ publicId })
          .where(and(eq(services.id, row.id), isNull(services.publicId))),
      );
    }
    return rows.length;
  }

  private async backfillInvitations() {
    const rows = await db
      .select({ id: invitations.id })
      .from(invitations)
      .where(isNull(invitations.publicId));
    for (const row of rows) {
      await this.assign((publicId) =>
        db
          .update(invitations)
          .set({ publicId })
          .where(and(eq(invitations.id, row.id), isNull(invitations.publicId))),
      );
    }
    return rows.length;
  }

  private async assign(update: (publicId: string) => Promise<unknown>) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        await update(generatePublicId());
        return;
      } catch (error) {
        if (!isPublicIdCollision(error) || attempt === 2) throw error;
      }
    }
  }
}
