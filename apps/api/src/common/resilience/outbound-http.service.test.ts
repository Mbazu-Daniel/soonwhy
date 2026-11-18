import dns from "node:dns";
import dnsPromises from "node:dns/promises";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OutboundHttpService } from "./outbound-http.service";

const resilience = {
  preset: () => ({ execute: (run: (ctx: { signal: AbortSignal }) => Promise<unknown>) => run({ signal: new AbortController().signal }) }),
};

describe("OutboundHttpService publicOnly", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("refuses a private target before any request is made", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const http = new OutboundHttpService(resilience as never);

    await expect(
      http.request({ url: "http://169.254.169.254/latest/meta-data", preset: "webhook", source: "test", publicOnly: true }),
    ).rejects.toThrow(/Private or reserved/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not use fetch for a public-only request", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(dnsPromises, "lookup").mockResolvedValue([{ address: "93.184.216.34", family: 4 }] as never);
    vi.spyOn(dns, "lookup").mockImplementation(((_host: string, _options: unknown, callback: (...args: unknown[]) => void) =>
      callback(new Error("connect blocked in test"), [])) as never);
    const service = new OutboundHttpService(resilience as never);

    await expect(
      service.request({ url: "http://hooks.example.com/x", preset: "webhook", source: "test", publicOnly: true, init: { method: "POST", body: "{}" } }),
    ).rejects.toThrow();

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("blocks a host that answers with a public address first and a private one when connecting", async () => {
    let hits = 0;
    const server = http.createServer((_req, res) => {
      hits += 1;
      res.writeHead(200).end("reached");
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const port = (server.address() as AddressInfo).port;

    vi.spyOn(dnsPromises, "lookup").mockResolvedValue([{ address: "93.184.216.34", family: 4 }] as never);
    vi.spyOn(dns, "lookup").mockImplementation(((_host: string, _options: unknown, callback: (...args: unknown[]) => void) =>
      callback(null, [{ address: "127.0.0.1", family: 4 }])) as never);
    const service = new OutboundHttpService(resilience as never);

    try {
      await expect(
        service.request({
          url: "http://rebind.example.com:" + port + "/hook",
          preset: "webhook",
          source: "test",
          publicOnly: true,
          init: { method: "POST", body: "{}" },
        }),
      ).rejects.toThrow(/Private or reserved address 127\.0\.0\.1/);
      expect(hits).toBe(0);
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  it("leaves requests to fixed hosts on fetch", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const service = new OutboundHttpService(resilience as never);

    await service.request({ url: "https://slack.com/api/chat.postMessage", preset: "slack", source: "test" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]![1]).not.toHaveProperty("redirect");
  });
});
