import { Logger } from "@nestjs/common";
import { QUICKWIT_INDEX_CONFIG, QUICKWIT_INDEXES, QuickwitService } from "@soonwhy/shared";

export async function ensureQuickwitIndexes(): Promise<void> {
  const quickwit = new QuickwitService();
  const logger = new Logger("QuickwitBootstrap");

  for (const indexId of Object.values(QUICKWIT_INDEXES)) {
    try {
      await quickwit.ensureIndex(indexId, { ...QUICKWIT_INDEX_CONFIG });
    } catch (error) {
      logger.warn(
        `Quickwit index "${indexId}" could not be ensured: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
