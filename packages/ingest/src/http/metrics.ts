import { Controller, Get, Header } from "@nestjs/common";
import { NatsService } from "@soonwhy/shared";
import { IngestConcurrency } from "../pipeline/concurrency";
import { IngestStats } from "../pipeline/stats";

function label(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
}

function line(name: string, value: number, labels?: Record<string, string>) {
  const suffix = labels
    ? `{${Object.entries(labels)
        .map(([key, entry]) => `${key}="${label(entry)}"`)
        .join(",")}}`
    : "";
  return `${name}${suffix} ${value}`;
}

@Controller()
export class MetricsController {
  constructor(
    private readonly nats: NatsService,
    private readonly stats: IngestStats,
    private readonly concurrency: IngestConcurrency,
  ) {}

  @Get("metrics")
  @Header("content-type", "text/plain; version=0.0.4; charset=utf-8")
  async scrape(): Promise<string> {
    const stats = this.stats.snapshot();
    const capacity = this.concurrency.snapshot();
    const consumers = this.nats.isReady()
      ? await this.nats.consumerSnapshot()
      : [];
    const subscriptions = this.nats.subscriptionSnapshot();

    return [
      "# HELP soonwhy_ingest_accepted_total Accepted records.",
      "# TYPE soonwhy_ingest_accepted_total counter",
      line("soonwhy_ingest_accepted_total", stats.accepted),
      "# HELP soonwhy_ingest_rejected_total Rejected records.",
      "# TYPE soonwhy_ingest_rejected_total counter",
      line("soonwhy_ingest_rejected_total", stats.rejected),
      "# HELP soonwhy_ingest_published_total Records published to JetStream.",
      "# TYPE soonwhy_ingest_published_total counter",
      line("soonwhy_ingest_published_total", stats.published),
      "# HELP soonwhy_ingest_inserted_total Records written to Quickwit.",
      "# TYPE soonwhy_ingest_inserted_total counter",
      line("soonwhy_ingest_inserted_total", stats.inserted),
      "# HELP soonwhy_ingest_duplicates_total Duplicate records skipped.",
      "# TYPE soonwhy_ingest_duplicates_total counter",
      line("soonwhy_ingest_duplicates_total", stats.duplicates),
      "# HELP soonwhy_ingest_dlq_total Records sent to the dead letter queue.",
      "# TYPE soonwhy_ingest_dlq_total counter",
      line("soonwhy_ingest_dlq_total", stats.dlq),
      "# HELP soonwhy_ingest_errors_total Ingest handler errors.",
      "# TYPE soonwhy_ingest_errors_total counter",
      line("soonwhy_ingest_errors_total", stats.errors),
      "# HELP soonwhy_ingest_in_flight In-flight ingest requests.",
      "# TYPE soonwhy_ingest_in_flight gauge",
      line("soonwhy_ingest_in_flight", stats.inFlight),
      "# HELP soonwhy_ingest_peak_in_flight Peak in-flight ingest requests.",
      "# TYPE soonwhy_ingest_peak_in_flight gauge",
      line("soonwhy_ingest_peak_in_flight", stats.peakInFlight),
      "# HELP soonwhy_ingest_average_latency_ms Average request latency.",
      "# TYPE soonwhy_ingest_average_latency_ms gauge",
      line("soonwhy_ingest_average_latency_ms", stats.averageLatencyMs),
      "# HELP soonwhy_ingest_capacity_limit Global ingest concurrency limit.",
      "# TYPE soonwhy_ingest_capacity_limit gauge",
      line("soonwhy_ingest_capacity_limit", capacity.limit),
      "# HELP soonwhy_nats_consumer_pending Messages pending delivery.",
      "# TYPE soonwhy_nats_consumer_pending gauge",
      ...consumers.map((consumer) =>
        line("soonwhy_nats_consumer_pending", consumer.pending, {
          subject: consumer.subject,
          durable: consumer.durable,
        }),
      ),
      "# HELP soonwhy_nats_consumer_ack_pending Messages awaiting ack.",
      "# TYPE soonwhy_nats_consumer_ack_pending gauge",
      ...consumers.map((consumer) =>
        line("soonwhy_nats_consumer_ack_pending", consumer.ackPending, {
          subject: consumer.subject,
          durable: consumer.durable,
        }),
      ),
      "# HELP soonwhy_nats_consumer_redelivered Redelivered messages.",
      "# TYPE soonwhy_nats_consumer_redelivered counter",
      ...consumers.map((consumer) =>
        line("soonwhy_nats_consumer_redelivered", consumer.redelivered, {
          subject: consumer.subject,
          durable: consumer.durable,
        }),
      ),
      "# HELP soonwhy_nats_consumer_processed_total Messages handled.",
      "# TYPE soonwhy_nats_consumer_processed_total counter",
      ...subscriptions.map((subscription) =>
        line("soonwhy_nats_consumer_processed_total", subscription.processed, {
          subject: subscription.subject,
          durable: subscription.durable,
        }),
      ),
      "# HELP soonwhy_nats_consumer_failed_total Message handler failures.",
      "# TYPE soonwhy_nats_consumer_failed_total counter",
      ...subscriptions.map((subscription) =>
        line("soonwhy_nats_consumer_failed_total", subscription.failed, {
          subject: subscription.subject,
          durable: subscription.durable,
        }),
      ),
      "",
    ].join("\n");
  }
}
