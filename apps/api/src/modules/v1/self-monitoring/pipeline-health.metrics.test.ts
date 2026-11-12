import { describe, expect, it } from "vitest";
import { parsePrometheus, sumSamples } from "./pipeline-health.metrics";

describe("parsePrometheus", () => {
  it("reads counters and labelled gauges", () => {
    const samples = parsePrometheus(
      [
        "# HELP soonwhy_ingest_errors_total errors",
        "# TYPE soonwhy_ingest_errors_total counter",
        "soonwhy_ingest_errors_total 7",
        'soonwhy_nats_consumer_ack_pending{subject="ingest.*.log",durable="ingest-log"} 3',
      ].join("\n"),
    );

    expect(sumSamples(samples, "soonwhy_ingest_errors_total")).toBe(7);
    expect(
      sumSamples(samples, "soonwhy_nats_consumer_ack_pending"),
    ).toBe(3);
    expect(samples[1]?.labels.durable).toBe("ingest-log");
  });

  it("ignores malformed lines", () => {
    expect(parsePrometheus("not a metric\nsoonwhy_total NaN")).toEqual([]);
  });
});
