import { describe, expect, it } from "vitest";
import { metricValues } from "./alert-metric-values";

const bucket = { bucket: "t", count: 12, p50: 10, p95: 40, p99: 90, _2xx: 8, _3xx: 0, _4xx: 2, _5xx: 2 };

describe("metricValues", () => {
  it("reads zero requests when nothing arrived, so a silence rule can fire", () => {
    expect(metricValues("http.server.request.count", undefined)).toEqual({ value: 0, requestCount: 0 });
  });

  it("keeps other metrics as no data when nothing arrived", () => {
    expect(metricValues("http.server.request.duration.p95", undefined)).toEqual({});
    expect(metricValues("http.server.request.errors.rate", undefined)).toEqual({});
  });

  it("computes the usual values from the latest bucket", () => {
    expect(metricValues("http.server.request.count", bucket)).toMatchObject({ value: 12 });
    expect(metricValues("http.server.request.errors.rate", bucket)).toMatchObject({ value: 33.33333333333333 });
    expect(metricValues("http.server.request.duration.p99", bucket)).toMatchObject({ value: 90 });
    expect(metricValues("unknown.metric", bucket)).toMatchObject({ value: 40 });
  });
});

describe("hostSampleValues", () => {
  it("passes the sample count through, including zero", async () => {
    const { hostSampleValues } = await import("./alert-metric-values");
    expect(hostSampleValues(0)).toEqual({ value: 0, sampleCount: 0 });
    expect(hostSampleValues(30)).toEqual({ value: 30, sampleCount: 30 });
  });
});
