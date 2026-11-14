import { describe, expect, it } from "vitest";
import { parseTracesPayload } from "../src/parse/traces";
import { mapSpanToTraceRow } from "../src/parse/mappers";

const organization = {
  projectId: "proj_1",
  organizationId: "org_1",
  captureSettings: {
    redactSensitiveData: true,
    captureRequestHeaders: true,
    captureRequestBody: true,
    captureResponseBody: true,
    maxAttributeCount: 100,
    maxAttributeValueLength: 4096,
  },
};

const startNano = String(BigInt(Date.now()) * 1_000_000n);
const attribute = (key: string, value: string) => ({ key, value: { stringValue: value } });

function payload(span: Record<string, unknown>) {
  return {
    resourceSpans: [
      {
        resource: { attributes: [attribute("service.name", "api"), attribute("host.name", "box-1")] },
        scopeSpans: [
          {
            spans: [
              {
                traceId: "a".repeat(32),
                spanId: "b".repeat(16),
                name: "GET /users/:id",
                kind: 2,
                startTimeUnixNano: startNano,
                endTimeUnixNano: String(BigInt(startNano) + 5_000_000n),
                status: { code: 2, message: "boom" },
                attributes: [attribute("http.route", "/users/:id"), attribute("authorization", "Bearer abc")],
                ...span,
              },
            ],
          },
        ],
      },
    ],
  };
}

describe("span detail fields", () => {
  it("keeps attributes and resource attributes, dropping secrets", () => {
    const { spans } = parseTracesPayload(payload({}));
    const row = mapSpanToTraceRow(spans[0]!, organization);
    expect(row.attributes).toMatchObject({ "http.route": "/users/:id" });
    expect(row.attributes).not.toHaveProperty("authorization");
    expect(row.resourceAttributes).toMatchObject({ "host.name": "box-1" });
  });

  it("flattens the exception event and keeps the stack out of the event list", () => {
    const { spans } = parseTracesPayload(
      payload({
        events: [
          {
            name: "exception",
            timeUnixNano: startNano,
            attributes: [
              attribute("exception.type", "TypeError"),
              attribute("exception.message", "x is not a function password=hunter2"),
              attribute("exception.stacktrace", "TypeError: x\n    at handler (app.js:10:3)"),
            ],
          },
          { name: "cache.miss", timeUnixNano: startNano, attributes: [attribute("key", "u:1")] },
        ],
      }),
    );
    const row = mapSpanToTraceRow(spans[0]!, organization);
    expect(row.exceptionType).toBe("TypeError");
    expect(row.exceptionMessage).toContain("x is not a function");
    expect(row.exceptionMessage).not.toContain("hunter2");
    expect(row.exceptionStacktrace).toContain("at handler (app.js:10:3)");
    expect(row.events.map((event) => event.name)).toEqual(["exception", "cache.miss"]);
    expect(row.events[0]!.attributes).not.toHaveProperty("exception.stacktrace");
    expect(row.events[1]).toMatchObject({ attributes: { key: "u:1" } });
  });

  it("keeps links and caps the number of events", () => {
    const events = Array.from({ length: 80 }, (_, index) => ({
      name: `e${index}`,
      timeUnixNano: startNano,
      attributes: [],
    }));
    const { spans } = parseTracesPayload(
      payload({ events, links: [{ traceId: "c".repeat(32), spanId: "d".repeat(16), attributes: [] }, { traceId: "", spanId: "" }] }),
    );
    const row = mapSpanToTraceRow(spans[0]!, organization);
    expect(row.events).toHaveLength(50);
    expect(row.links).toEqual([{ traceId: "c".repeat(32), spanId: "d".repeat(16), attributes: {} }]);
  });

  it("keeps error.type separate from exception events", () => {
    const { spans } = parseTracesPayload(payload({ attributes: [attribute("error.type", "timeout")] }));
    const row = mapSpanToTraceRow(spans[0]!, organization);
    expect(row.errorType).toBe("timeout");
    expect(row.exceptionType).toBeUndefined();
  });

  it("reads a JSON status code given as an enum name", () => {
    const { spans } = parseTracesPayload(payload({ status: { code: "STATUS_CODE_ERROR", message: "bad" } }));
    expect(spans[0]!.statusCode).toBe(2);
    expect(mapSpanToTraceRow(spans[0]!, organization).statusCode).toBe(2);
  });
});

describe("span details on older or sensitive payloads", () => {
  it("accepts a span without events, links or resource attributes", () => {
    const { spans } = parseTracesPayload(payload({}));
    const legacy = { ...spans[0]!, events: undefined, links: undefined, resource: { ...spans[0]!.resource, attributes: undefined } } as never;
    const row = mapSpanToTraceRow(legacy, organization);
    expect(row.events).toEqual([]);
    expect(row.links).toEqual([]);
    expect(row.resourceAttributes).toEqual({});
  });

  it("redacts credentials in event names", () => {
    const { spans } = parseTracesPayload(payload({ events: [{ name: "operation failed password=hunter2", timeUnixNano: "1", attributes: [] }] }));
    expect(JSON.stringify(mapSpanToTraceRow(spans[0]!, organization).events)).not.toContain("hunter2");
  });
});

describe("http status on spans", () => {
  it("stores a numeric http status code from either attribute name", () => {
    const stable = parseTracesPayload(payload({ attributes: [attribute("http.response.status_code", "404")] }));
    expect(mapSpanToTraceRow(stable.spans[0]!, organization).httpStatusCode).toBe(404);
    const legacy = parseTracesPayload(payload({ attributes: [attribute("http.status_code", "503")] }));
    expect(mapSpanToTraceRow(legacy.spans[0]!, organization).httpStatusCode).toBe(503);
  });

  it("leaves it out when the value is not a status code", () => {
    const { spans } = parseTracesPayload(payload({ attributes: [attribute("http.status_code", "abc")] }));
    expect(mapSpanToTraceRow(spans[0]!, organization).httpStatusCode).toBeUndefined();
  });
});
