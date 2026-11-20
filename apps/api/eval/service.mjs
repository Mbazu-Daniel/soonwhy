import http from "node:http";
import { createRequire } from "node:module";

const require = createRequire(new URL("../../../sdk/node/package.json", import.meta.url));
const { context, trace, SpanKind, SpanStatusCode, ROOT_CONTEXT } = require("@opentelemetry/api");
const { BasicTracerProvider, SimpleSpanProcessor } = require("@opentelemetry/sdk-trace-base");
const { resourceFromAttributes } = require("@opentelemetry/resources");

const SERVICE = process.env.SERVICE;
const PORT = Number(process.env.PORT);
const PORTS = JSON.parse(process.env.PORTS);

const TOPOLOGY = {
  gateway: { work: 5, steps: [{ seq: ["orders"] }] },
  orders: { work: 8, steps: [{ par: ["inventory", "payments"] }, { seq: ["db"] }] },
  inventory: { work: 10, steps: [{ seq: ["db"] }] },
  payments: { work: 12, steps: [{ seq: ["fraud"] }] },
  fraud: { work: 20, steps: [] },
  db: { work: 15, steps: [] },
};

let fault = { delayMs: 0, errorRate: 0, spinMs: 0 };
let seed = 1;
function rand() {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

const exporter = {
  export(spans, done) {
    for (const s of spans) {
      process.send?.({
        type: "span",
        service: SERVICE,
        traceId: s.spanContext().traceId,
        spanId: s.spanContext().spanId,
        parentSpanId: s.parentSpanContext?.spanId,
        name: s.name,
        kind: s.kind === SpanKind.SERVER ? "server" : "client",
        peer: s.attributes["peer.service"],
        start: s.startTime[0] * 1e3 + s.startTime[1] / 1e6,
        end: s.endTime[0] * 1e3 + s.endTime[1] / 1e6,
        error: s.status.code === SpanStatusCode.ERROR,
      });
    }
    done({ code: 0 });
  },
  shutdown: () => Promise.resolve(),
};

const provider = new BasicTracerProvider({
  resource: resourceFromAttributes({ "service.name": SERVICE }),
  spanProcessors: [new SimpleSpanProcessor(exporter)],
});
const tracer = provider.getTracer("eval-sample-app");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const jitter = (ms) => ms * (0.85 + rand() * 0.3);

function spin(ms) {
  const end = performance.now() + ms;
  while (performance.now() < end) {}
}

function call(target, ctx) {
  const span = tracer.startSpan(`call ${target}`, { kind: SpanKind.CLIENT, attributes: { "peer.service": target } }, ctx);
  const childCtx = trace.setSpan(ctx, span);
  const { traceId, spanId } = span.spanContext();
  return new Promise((resolve) => {
    const req = http.request(
      { host: "127.0.0.1", port: PORTS[target], path: "/", headers: { traceparent: `00-${traceId}-${spanId}-01` } },
      (res) => {
        res.resume();
        res.on("end", () => {
          if (res.statusCode >= 500) span.setStatus({ code: SpanStatusCode.ERROR });
          span.end();
          resolve(res.statusCode);
        });
      },
    );
    req.on("error", () => {
      span.setStatus({ code: SpanStatusCode.ERROR });
      span.end();
      resolve(599);
    });
    req.end();
  });
}

async function handle(req, res) {
  const tp = req.headers.traceparent;
  let parent = ROOT_CONTEXT;
  if (tp) {
    const [, traceId, spanId] = tp.split("-");
    parent = trace.setSpanContext(ROOT_CONTEXT, { traceId, spanId, traceFlags: 1, isRemote: true });
  }
  const span = tracer.startSpan(`${SERVICE} handle`, { kind: SpanKind.SERVER }, parent);
  const ctx = trace.setSpan(parent, span);
  const cfg = TOPOLOGY[SERVICE];
  let failed = false;

  await sleep(jitter(cfg.work));
  if (fault.spinMs > 0) spin(fault.spinMs);
  if (fault.delayMs > 0) await sleep(jitter(fault.delayMs));
  if (fault.errorRate > 0 && rand() < fault.errorRate) failed = true;

  if (!failed) {
    for (const step of cfg.steps) {
      const targets = step.seq ?? step.par;
      const codes = step.par ? await Promise.all(targets.map((t) => call(t, ctx))) : [await call(targets[0], ctx)];
      if (codes.some((c) => c >= 500)) {
        failed = true;
        break;
      }
    }
  }

  if (failed) span.setStatus({ code: SpanStatusCode.ERROR });
  span.end();
  res.statusCode = failed ? 500 : 200;
  res.end();
}

http
  .createServer((req, res) => {
    handle(req, res).catch(() => {
      res.statusCode = 500;
      res.end();
    });
  })
  .listen(PORT, "127.0.0.1", () => process.send?.({ type: "ready", service: SERVICE }));

process.on("message", (msg) => {
  if (msg.type === "fault") {
    fault = { delayMs: 0, errorRate: 0, spinMs: 0, ...msg.fault };
    process.send?.({ type: "fault-ack", service: SERVICE, at: Date.now() });
  }
  if (msg.type === "seed") seed = msg.seed;
  if (msg.type === "exit") process.exit(0);
});
