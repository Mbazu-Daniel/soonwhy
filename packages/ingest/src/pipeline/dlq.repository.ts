import { Inject, Injectable } from "@nestjs/common";
import { DB, deadLetterQueue, type Db } from "@soonwhy/shared";

type DlqEntryData = {
  signal: string;
  deliveryCount: number;
  reason: string;
  payload: unknown;
  organizationId?: string;
  projectId?: string;
};

@Injectable()
export class DlqRepository {
  constructor(@Inject(DB) private readonly db: Db) {}

  async createDlqEntry(data: DlqEntryData) {
    const [entry] = await this.db
      .insert(deadLetterQueue)
      .values({
        signal: data.signal,
        deliveryCount: data.deliveryCount,
        reason: data.reason,
        payload: data.payload as never,
        organizationId: data.organizationId,
        projectId: data.projectId,
      })
      .returning();
    return entry;
  }
}
