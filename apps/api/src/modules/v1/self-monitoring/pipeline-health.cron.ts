import { quickwitSource } from "../../../common/quickwit/query";
import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { QUICKWIT_INDEXES, QuickwitService, requiredEnvInProduction } from "@soonwhy/shared";
import { parsePrometheus, sumSamples } from "./pipeline-health.metrics";

type Thresholds = {
  errorsPerMinute: number;
  dlqPerMinute: number;
  ackPending: number;
  lagMs: number;
};

type PreviousCounters = {
  errors: number;
  dlq: number;
  at: number;
};

type Alert = {
  key: string;
  message: string;
  value: number;
  threshold: number;
};

@Injectable()
export class PipelineHealthCron {
  private readonly logger = new Logger(PipelineHealthCron.name);
  private readonly ingestUrl = (
    requiredEnvInProduction("INGEST_URL", "http://localhost:3002")
  ).replace(/\/$/, "");
  private readonly webhookUrl = process.env.SELF_MONITOR_WEBHOOK_URL?.trim();
  private readonly thresholds: Thresholds = {
    errorsPerMinute: Number(process.env.SELF_MONITOR_INGEST_ERRORS_PER_MIN ?? 10),
    dlqPerMinute: Number(process.env.SELF_MONITOR_DLQ_PER_MIN ?? 1),
    ackPending: Number(process.env.SELF_MONITOR_ACK_PENDING ?? 100),
    lagMs: Number(process.env.SELF_MONITOR_LAG_MS ?? 120_000),
  };
  private previous: PreviousCounters | undefined;
  private readonly lastAlerts = new Map<string, number>();

  constructor(private readonly quickwit: QuickwitService) {}

  @Cron(CronExpression.EVERY_MINUTE, {
    name: "pipeline-health",
    timeZone: "UTC",
  })
  async check() {
    const alerts: Alert[] = [];
    const now = Date.now();

    try {
      const response = await fetch(`${this.ingestUrl}/metrics`, {
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) throw new Error(`metrics returned ${response.status}`);
      const samples = parsePrometheus(await response.text());
      const errors = sumSamples(samples, "soonwhy_ingest_errors_total");
      const dlq = sumSamples(samples, "soonwhy_ingest_dlq_total");
      const ackPending = sumSamples(
        samples,
        "soonwhy_nats_consumer_ack_pending",
      );

      if (this.previous) {
        const elapsedMinutes = Math.max(
          1,
          (now - this.previous.at) / 60_000,
        );
        const errorRate = (errors - this.previous.errors) / elapsedMinutes;
        const dlqRate = (dlq - this.previous.dlq) / elapsedMinutes;
        if (errorRate > this.thresholds.errorsPerMinute)
          alerts.push({
            key: "ingest-errors",
            message: "Ingest error rate is above threshold",
            value: errorRate,
            threshold: this.thresholds.errorsPerMinute,
          });
        if (dlqRate > this.thresholds.dlqPerMinute)
          alerts.push({
            key: "dlq-inflow",
            message: "DLQ inflow is above threshold",
            value: dlqRate,
            threshold: this.thresholds.dlqPerMinute,
          });
      }

      this.previous = { errors, dlq, at: now };

      if (ackPending > this.thresholds.ackPending)
        alerts.push({
          key: "nats-ack-pending",
          message: "NATS ack pending is above threshold",
          value: ackPending,
          threshold: this.thresholds.ackPending,
        });
    } catch (error) {
      alerts.push({
        key: "ingest-unreachable",
        message:
          error instanceof Error ? error.message : "Ingest metrics unavailable",
        value: 0,
        threshold: 0,
      });
    }

    const lag = await this.quickwitLag();
    if (lag > this.thresholds.lagMs)
      alerts.push({
        key: "quickwit-lag",
        message: "Quickwit indexing lag is above threshold",
        value: lag,
        threshold: this.thresholds.lagMs,
      });

    for (const alert of alerts) {
      if (!this.shouldAlert(alert.key, now)) continue;
      this.logger.warn(`PIPELINE_ALERT ${JSON.stringify(alert)}`);
      await this.dispatch(alert);
    }
  }

  private async quickwitLag(): Promise<number> {
    let latest = 0;
    for (const indexId of Object.values(QUICKWIT_INDEXES)) {
      try {
        const result = await this.quickwit.search<{ timestamp?: string }>(
          indexId,
          { query: "*", maxHits: 1, sortBy: ["timestamp:desc"] },
        );
        const timestamp = quickwitSource<{ timestamp?: string }>(result.hits[0])?.timestamp;
        if (!timestamp) continue;
        const value = new Date(timestamp).getTime();
        if (Number.isFinite(value)) latest = Math.max(latest, value);
      } catch {
        continue;
      }
    }
    return latest > 0 ? Math.max(0, Date.now() - latest) : 0;
  }

  private shouldAlert(key: string, now: number): boolean {
    const last = this.lastAlerts.get(key) ?? 0;
    if (now - last < 5 * 60_000) return false;
    this.lastAlerts.set(key, now);
    return true;
  }

  private async dispatch(alert: Alert) {
    if (!this.webhookUrl) return;
    try {
      await fetch(this.webhookUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          source: "soonwhy-pipeline-health",
          alert,
          at: new Date().toISOString(),
        }),
        signal: AbortSignal.timeout(5000),
      });
    } catch (error) {
      this.logger.error(
        "Failed to dispatch pipeline alert",
        error instanceof Error ? error.message : String(error),
      );
    }
  }
}
