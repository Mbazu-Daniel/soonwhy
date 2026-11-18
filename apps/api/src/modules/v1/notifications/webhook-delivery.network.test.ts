import { createHmac } from "node:crypto";
import dns from "node:dns";
import dnsPromises from "node:dns/promises";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../common/net/public-address", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../../common/net/public-address")>();
  return { ...original, isPublicIpAddress: (address: string) => address === "127.0.0.1" || original.isPublicIpAddress(address) };
});

import { OutboundHttpService } from "../../../common/resilience/outbound-http.service";
import { WebhookService } from "./webhook.service";

const resilience = {
  preset: () => ({ execute: (run: (ctx: { signal: AbortSignal }) => Promise<unknown>) => run({ signal: new AbortController().signal }) }),
};

let server: http.Server;
let port: number;
let received: Array<{ headers: http.IncomingHttpHeaders; body: string }>;
let replyStatus: number;

beforeEach(async () => {
  received = [];
  replyStatus = 200;
  server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (chunk: Buffer) => (body += chunk.toString()));
    req.on("end", () => {
      received.push({ headers: req.headers, body });
      res.writeHead(replyStatus).end("ok");
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  port = (server.address() as AddressInfo).port;

  vi.spyOn(dnsPromises, "lookup").mockResolvedValue([{ address: "93.184.216.34", family: 4 }] as never);
  vi.spyOn(dns, "lookup").mockImplementation(((_host: string, _options: unknown, callback: (...args: unknown[]) => void) =>
    callback(null, [{ address: "127.0.0.1", family: 4 }])) as never);
});

afterEach(async () => {
  vi.restoreAllMocks();
  await new Promise((resolve) => server.close(resolve));
});

describe("webhook delivery over a real socket", () => {
  it("delivers a signed alert that the receiver can verify", async () => {
    const service = new WebhookService(new OutboundHttpService(resilience as never));

    const result = await service.deliver({
      url: "http://hooks.example.com:" + port + "/hook",
      secret: "shared-secret",
      eventType: "alert.triggered",
      eventId: "incident-1:channel-1",
      payload: { subject: "Checkout is slow", body: "p95 1600ms" },
    });

    expect(result).toMatchObject({ ok: true, statusCode: 200 });
    expect(received).toHaveLength(1);
    const { headers, body } = received[0]!;
    expect(JSON.parse(body)).toMatchObject({ subject: "Checkout is slow" });
    expect(headers["x-soonwhy-event"]).toBe("alert.triggered");
    expect(headers["x-soonwhy-event-id"]).toBe("incident-1:channel-1");
    expect(headers["content-type"]).toBe("application/json");
    const expected = createHmac("sha256", "shared-secret")
      .update(String(headers["x-soonwhy-timestamp"]) + "." + body)
      .digest("hex");
    expect(headers["x-soonwhy-signature"]).toBe("sha256=" + expected);
  });

  it("reports a receiver error as a failed delivery", async () => {
    replyStatus = 500;
    const service = new WebhookService(new OutboundHttpService(resilience as never));

    const result = await service.deliver({
      url: "http://hooks.example.com:" + port + "/hook",
      eventType: "alert.triggered",
      payload: { subject: "x" },
    });

    expect(result).toMatchObject({ ok: false, statusCode: 500 });
    expect(received).toHaveLength(1);
  });

  it("does not follow a redirect to another address", async () => {
    server.removeAllListeners("request");
    const hits: string[] = [];
    server.on("request", (req, res) => {
      hits.push(req.url ?? "");
      res.writeHead(302, { Location: "http://127.0.0.1:" + port + "/internal" }).end();
    });
    const service = new WebhookService(new OutboundHttpService(resilience as never));

    const result = await service.deliver({
      url: "http://hooks.example.com:" + port + "/hook",
      eventType: "alert.triggered",
      payload: { subject: "x" },
    });

    expect(result.ok).toBe(false);
    expect(hits).toEqual(["/hook"]);
  });
});
