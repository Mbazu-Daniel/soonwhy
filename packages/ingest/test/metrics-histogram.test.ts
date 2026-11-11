import { describe, expect, it } from "vitest";
import { parseMetricsPayload } from "../src/parse/metrics";
import { mapMetricToRow } from "../src/parse/mappers";

const organization = {
  projectId: "proj_1",
  organizationId: "org_1",
  captureSettings: {
    redactSensitiveData: true,
    captureRequestHeaders: false,
    captureRequestBody: false,
    captureResponseBody: false,
    maxAttributeCount: 100,
    maxAttributeValueLength: 4096,
  },
};

const timestamp = String(BigInt(Date.now()) * 1_000_000n);

describe("OTLP metric types", () => {
  it("parses histogram data points with buckets and temporality", () => {
    const { points, rejected } = parseMetricsPayload({
      resourceMetrics: [
        {
          resource: {
            attributes: [
              { key: "service.name", value: { stringValue: "api" } },
            ],
          },
          scopeMetrics: [
            {
              metrics: [
                {
                  name: "http.server.request.duration",
                  unit: "ms",
                  histogram: {
                    aggregationTemporality: 2,
                    dataPoints: [
                      {
                        timeUnixNano: timestamp,
                        count: 10,
                        sum: 500,
                        min: 5,
                        max: 120,
                        bucketCounts: [2, 5, 3],
                        explicitBounds: [10, 50],
                      },
                    ],
                  },
                },
              ],
            },
          ],
        },
      ],
    });

    expect(rejected).toBe(0);
    const point = points[0]!;
    expect(point.metricType).toBe("histogram");
    expect(point.aggregationTemporality).toBe("cumulative");
    expect(point.value).toBe(50);
    expect(point.histogram).toEqual({
      count: 10,
      sum: 500,
      min: 5,
      max: 120,
      bucketCounts: [2, 5, 3],
      explicitBounds: [10, 50],
    });

    const row = mapMetricToRow(point, organization);
    expect(row.metricType).toBe("histogram");
    expect(row.histogramCount).toBe(10);
    expect(row.histogramBucketCounts).toEqual([2, 5, 3]);
  });

  it("parses summary data points with quantiles", () => {
    const { points, rejected } = parseMetricsPayload({
      resourceMetrics: [
        {
          resource: {
            attributes: [
              { key: "service.name", value: { stringValue: "api" } },
            ],
          },
          scopeMetrics: [
            {
              metrics: [
                {
                  name: "rpc.server.duration",
                  unit: "ms",
                  summary: {
                    dataPoints: [
                      {
                        timeUnixNano: timestamp,
                        count: 20,
                        sum: 2000,
                        quantileValues: [
                          { quantile: 0.5, value: 80 },
                          { quantile: 0.95, value: 180 },
                          { quantile: 0.99, value: 200 },
                        ],
                      },
                    ],
                  },
                },
              ],
            },
          ],
        },
      ],
    });

    expect(rejected).toBe(0);
    const point = points[0]!;
    expect(point.metricType).toBe("summary");
    expect(point.value).toBe(100);
    expect(point.summary?.quantiles).toHaveLength(3);
  });

  it("parses exponential histograms", () => {
    const { points, rejected } = parseMetricsPayload({
      resourceMetrics: [
        {
          resource: {
            attributes: [
              { key: "service.name", value: { stringValue: "api" } },
            ],
          },
          scopeMetrics: [
            {
              metrics: [
                {
                  name: "queue.latency",
                  exponentialHistogram: {
                    aggregationTemporality: 1,
                    dataPoints: [
                      {
                        timeUnixNano: timestamp,
                        count: 8,
                        sum: 80,
                        scale: 2,
                        zeroCount: 1,
                        zeroThreshold: 0.001,
                        positive: { offset: 0, bucketCounts: [3, 4] },
                        negative: { offset: 0, bucketCounts: [] },
                      },
                    ],
                  },
                },
              ],
            },
          ],
        },
      ],
    });

    expect(rejected).toBe(0);
    const point = points[0]!;
    expect(point.metricType).toBe("exponential_histogram");
    expect(point.aggregationTemporality).toBe("delta");
    expect(point.exponentialHistogram?.positiveBuckets).toEqual([3, 4]);
  });

  it("rejects a metric with no recognised data type", () => {
    const { points, rejected } = parseMetricsPayload({
      resourceMetrics: [
        {
          scopeMetrics: [
            {
              metrics: [{ name: "unknown.metric" }],
            },
          ],
        },
      ],
    });
    expect(points).toHaveLength(0);
    expect(rejected).toBe(1);
  });
});
