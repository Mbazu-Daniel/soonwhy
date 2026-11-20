import { createServer, request as httpRequest, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { captureBodies, describeBody } from "./body-capture.js";
import { buildInstrumentationConfig } from "./instrumentation.js";

const OPTIONS = { maxBytes: 1024, maxAttributeValueLength: 4096 };
const body = (text: string) => ({ chunks: [Buffer.from(text)], size: Buffer.byteLength(text), total: Buffer.byteLength(text) });

describe("describeBody", () => {
  it("keeps names and types, never values", () => {
    const stored = describeBody(body('{"email":"jane@example.com","n":1}'), "application/json", 4096)!;
    expect(stored.shape).toEqual({ type: "object", fields: { email: { type: "string" }, n: { type: "number" } } });
    expect(JSON.stringify(stored)).not.toContain("jane");
  });

  it("records only the size for non-JSON, truncated or empty bodies", () => {
    expect(describeBody(body("hello"), "text/plain", 4096)).toEqual({ bytes: 5, format: "text" });
    expect(describeBody({ chunks: [], size: 0, total: 5000 }, "application/json", 4096)).toEqual({ bytes: 5000, format: "text" });
    expect(describeBody({ chunks: [], size: 0, total: 0 }, "application/json", 4096)).toBeNull();
  });

  it("drops the shape when it would not fit in an attribute", () => {
    const wide = JSON.stringify(Object.fromEntries(Array.from({ length: 40 }, (_, i) => [`field_number_${i}`, i])));
    expect(describeBody(body(wide), "application/json", 200)).toEqual({ bytes: wide.length, format: "json" });
  });
});

describe("body shape rules", () => {
  it("match ingest's, which asserts the same shape for the same body", () => {
    const text = JSON.stringify({ a: 1, b: { c: ["x", "y"], d: null }, e: [{ f: true }], g: [] });
    expect(describeBody(body(text), "application/json", 4096)!.shape).toEqual({
      type: "object",
      fields: {
        a: { type: "number" },
        b: { type: "object", fields: { c: { type: "array", length: 2, items: { type: "string" } }, d: { type: "null" } } },
        e: { type: "array", length: 1, items: { type: "object", fields: { f: { type: "boolean" } } } },
        g: { type: "array", length: 0, items: null },
      },
    });
  });
});

describe("instrumentation config", () => {
  it("adds the response hook only when body capture is requested", () => {
    const requested = { http: true, express: true, nestjs: true, postgres: true, redis: true, ioredis: true };
    expect(buildInstrumentationConfig(requested)["@opentelemetry/instrumentation-http"]).not.toHaveProperty("responseHook");
    expect(buildInstrumentationConfig(requested, OPTIONS)["@opentelemetry/instrumentation-http"]).toHaveProperty("responseHook");
  });
});

describe("captureBodies on a real server", () => {
  let server: Server;
  afterEach(() => new Promise<void>((resolve) => server.close(() => resolve())));

  async function roundTrip(payload: string) {
    const attributes: Record<string, string> = {};
    let received = "";
    server = createServer((req, res) => {
      captureBodies({ setAttribute: (key, value) => { attributes[key] = value; } }, res, OPTIONS);
      req.on("data", (chunk: Buffer) => { received += chunk.toString(); });
      req.on("end", () => {
        res.setHeader("content-type", "application/json");
        res.end(JSON.stringify({ ok: true, token: "abc" }));
      });
    });
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const { port } = server.address() as AddressInfo;
    const reply = await new Promise<string>((resolve) => {
      const req = httpRequest({ port, method: "POST", headers: { "content-type": "application/json" } }, (res) => {
        let text = "";
        res.on("data", (chunk: Buffer) => { text += chunk.toString(); });
        res.on("end", () => resolve(text));
      });
      req.end(payload);
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
    return { attributes, received, reply };
  }

  it("captures both bodies without changing what the app sees", async () => {
    const { attributes, received, reply } = await roundTrip('{"password":"hunter2"}');
    expect(received).toBe('{"password":"hunter2"}');
    expect(reply).toBe('{"ok":true,"token":"abc"}');
    const request = JSON.parse(attributes["http.request.body"]!);
    const response = JSON.parse(attributes["http.response.body"]!);
    expect(request.shape.fields.password).toEqual({ type: "string" });
    expect(response.shape.fields).toHaveProperty("token");
    expect(JSON.stringify(attributes)).not.toMatch(/hunter2|abc/);
  });
});
