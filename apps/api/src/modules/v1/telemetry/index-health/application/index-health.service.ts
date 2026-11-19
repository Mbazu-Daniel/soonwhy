import { Injectable } from "@nestjs/common";
import { QUICKWIT_INDEXES, QuickwitService } from "@soonwhy/shared";
import { toIndexHealth, unavailableIndex } from "../domain/index-health";
import { SPLIT_LIST_LIMIT } from "../domain/index-health.constants";
import type { IndexHealth, IndexHealthSnapshot } from "../domain/index-health.types";

const DEFAULT_STALE_MINUTES = 60;

function staleAfterMinutes(): number {
  const parsed = Number(process.env.INDEX_STALE_MINUTES);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_STALE_MINUTES;
}

@Injectable()
export class IndexHealthService {
  constructor(private readonly quickwit: QuickwitService) {}

  async snapshot(): Promise<IndexHealthSnapshot> {
    const staleMinutes = staleAfterMinutes();
    const indexes = await Promise.all(
      Object.values(QUICKWIT_INDEXES).map((indexId) => this.inspect(indexId, staleMinutes)),
    );
    return { indexes, staleAfterMinutes: staleMinutes, checkedAt: new Date().toISOString() };
  }

  private async inspect(indexId: string, staleMinutes: number): Promise<IndexHealth> {
    try {
      const [description, splits] = await Promise.all([
        this.quickwit.describeIndex(indexId),
        this.quickwit.listSplits(indexId, SPLIT_LIST_LIMIT),
      ]);
      return toIndexHealth(description, splits, staleMinutes);
    } catch (error) {
      return unavailableIndex(indexId, error);
    }
  }
}
