import { Injectable, Logger } from "@nestjs/common";
import { ALERT_COOLDOWN_MS, ALERT_WEBHOOK_TIMEOUT_MS } from "./constants";

@Injectable()
export class AlertNotifier {
  private readonly logger = new Logger(AlertNotifier.name);
  private readonly lastSentAt = new Map<string, number>();

  async notify(kind: string, message: string, now = Date.now()): Promise<boolean> {
    const url = process.env.INGEST_ALERT_WEBHOOK_URL;
    if (!url) return false;
    const previous = this.lastSentAt.get(kind);
    if (previous !== undefined && now - previous < ALERT_COOLDOWN_MS) return false;

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: message }),
        signal: AbortSignal.timeout(ALERT_WEBHOOK_TIMEOUT_MS),
      });
      if (!response.ok) throw new Error(`webhook answered ${response.status}`);
      this.lastSentAt.set(kind, now);
      return true;
    } catch (error) {
      this.logger.warn(`Could not deliver the "${kind}" alert: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }
}
