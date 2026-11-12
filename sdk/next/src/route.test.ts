import {
  BasicTracerProvider,
  InMemorySpanExporter,
  SimpleSpanProcessor,
} from "@opentelemetry/sdk-trace-base";
import { AsyncLocalStorageContextManager } from "@opentelemetry/context-async-hooks";
import { SpanKind, SpanStatusCode, context, trace } from "@opentelemetry/api";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { withSoonwhy } from "./route.js";

const exporter = new InMemorySpanExporter();
let provider: BasicTracerProvider;

beforeAll(() => {
  context.setGlobalContextManager(
    new AsyncLocalStorageContextManager().enable(),
  );
  provider = new BasicTracerProvider({
    spanProcessors: [new SimpleSpanProcessor(exporter)],
  });
  trace.setGlobalTracerProvider(provider);
});

afterAll(async () => {
  await provider.shutdown();
});

function takeSpans() {
  const spans = exporter.getFinishedSpans();
  exporter.reset();
  return spans;
}

describe("withSoonwhy", () => {
  it("passes the response through and records a SERVER span", async () => {
    const handler = withSoonwhy(
      () => new Response("ok", { status: 200 }),
    );
    const response = await handler(new Request("http://localhost/users/42"));

    expect(await response.text()).toBe("ok");

    const spans = takeSpans();
    expect(spans).toHaveLength(1);
    expect(spans[0].name).toBe("GET /users/:id");
    expect(spans[0].kind).toBe(SpanKind.SERVER);
    expect(spans[0].attributes["http.route"]).toBe("/users/:id");
    expect(spans[0].attributes["http.request.method"]).toBe("GET");
    expect(spans[0].attributes["http.response.status_code"]).toBe(200);
  });

  it("marks 5xx responses as errored spans", async () => {
    const handler = withSoonwhy(
      () => new Response("down", { status: 503 }),
    );
    await handler(new Request("http://localhost/health"));

    const spans = takeSpans();
    expect(spans).toHaveLength(1);
    expect(spans[0].status.code).toBe(SpanStatusCode.ERROR);
  });

  it("records the exception and rethrows", async () => {
    const failure = new Error("boom");
    const handler = withSoonwhy(() => {
      throw failure;
    });

    await expect(
      handler(new Request("http://localhost/failure")),
    ).rejects.toThrow("boom");

    const spans = takeSpans();
    expect(spans).toHaveLength(1);
    expect(spans[0].status.code).toBe(SpanStatusCode.ERROR);
    expect(spans[0].attributes["http.response.status_code"]).toBe(500);
    expect(
      spans[0].events.some((event) => event.name === "exception"),
    ).toBe(true);
  });

  it("skips default ignored paths without creating a span", async () => {
    const handler = withSoonwhy(
      () => new Response("asset"),
    );
    const response = await handler(new Request("http://localhost/favicon.ico"));

    expect(await response.text()).toBe("asset");
    expect(takeSpans()).toHaveLength(0);
  });

  it("honours a custom ignore filter", async () => {
    const handler = withSoonwhy(() => new Response("ok"), {
      ignore: () => true,
    });
    await handler(new Request("http://localhost/secret"));

    expect(takeSpans()).toHaveLength(0);
  });

  it("fails closed on telemetry when the ignore filter throws", async () => {
    const handler = withSoonwhy(() => new Response("ok"), {
      ignore: () => {
        throw new Error("filter exploded");
      },
    });
    const response = await handler(new Request("http://localhost/maybe"));

    expect(await response.text()).toBe("ok");
    expect(takeSpans()).toHaveLength(0);
  });

  it("uses routeResolver when provided", async () => {
    const handler = withSoonwhy(() => new Response("ok"), {
      routeResolver: () => "/resolved/:name",
    });
    await handler(new Request("http://localhost/anything/at/all"));

    const spans = takeSpans();
    expect(spans).toHaveLength(1);
    expect(spans[0].name).toBe("GET /resolved/:name");
    expect(spans[0].attributes["http.route"]).toBe("/resolved/:name");
  });

  it("reuses the active span instead of starting a new one", async () => {
    const tracer = trace.getTracer("test");
    const handler = withSoonwhy(
      () => new Response("ok"),
    );

    await tracer.startActiveSpan("outer", async (outer) => {
      await handler(new Request("http://localhost/users/7"));
      outer.end();
    });

    const spans = takeSpans();
    expect(spans).toHaveLength(1);
    expect(spans[0].name).toBe("GET /users/:id");
  });
});
