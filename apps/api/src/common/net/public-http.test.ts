import dns from "node:dns";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { publicHttpRequest } from "./public-http";

let server: http.Server;
let port: number;
let seen: Array<{ method?: string; url?: string; body: string; headers: http.IncomingHttpHeaders }>;
let respond: (res: http.ServerResponse) => void;

const toLoopback: Parameters<typeof publicHttpRequest>[0]["lookup"] = (_host, options, callback) => {
  if (options?.all) callback(null, [{ address: "127.0.0.1", family: 4 }]);
  else callback(null, "127.0.0.1", 4);
};

beforeEach(async () => {
  seen = [];
  respond = (res) => res.writeHead(200).end("ok");
  server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (chunk: Buffer) => (body += chunk.toString()));
    req.on("end", () => {
      seen.push({ method: req.method, url: req.url, body, headers: req.headers });
      respond(res);
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  port = (server.address() as AddressInfo).port;
});

afterEach(async () => {
  vi.restoreAllMocks();
  await new Promise((resolve) => server.close(resolve));
});

describe("publicHttpRequest", () => {
  it("sends the method, headers and body and reports the status", async () => {
    const result = await publicHttpRequest({
      url: "http://hooks.example.com:" + port + "/in?x=1",
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Soonwhy-Event": "alert.triggered" },
      body: '{"a":1}',
      lookup: toLoopback,
    });

    expect(result.status).toBe(200);
    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatchObject({ method: "POST", url: "/in?x=1", body: '{"a":1}' });
    expect(seen[0]!.headers["x-soonwhy-event"]).toBe("alert.triggered");
    expect(seen[0]!.headers["content-length"]).toBe("7");
  });

  it("does not follow a redirect", async () => {
    respond = (res) => res.writeHead(302, { Location: "http://127.0.0.1:" + port + "/elsewhere" }).end();

    const result = await publicHttpRequest({ url: "http://hooks.example.com:" + port + "/", method: "POST", body: "{}", lookup: toLoopback });

    expect(result.status).toBe(302);
    expect(seen).toHaveLength(1);
  });

  it("refuses a hostname that resolves to a private address, without connecting", async () => {
    vi.spyOn(dns, "lookup").mockImplementation(((_host: string, _options: unknown, callback: (...args: unknown[]) => void) =>
      callback(null, [{ address: "127.0.0.1", family: 4 }])) as never);

    await expect(publicHttpRequest({ url: "http://rebind.example.com:" + port + "/", method: "POST", body: "{}" })).rejects.toThrow(
      /Private or reserved address 127\.0\.0\.1/,
    );
    expect(seen).toHaveLength(0);
  });

  it("refuses a private literal address before any lookup", () => {
    expect(() => publicHttpRequest({ url: "http://127.0.0.1:" + port + "/" })).toThrow(/Private or reserved/);
    expect(seen).toHaveLength(0);
  });

  it("rejects a body that is not a string", () => {
    expect(() => publicHttpRequest({ url: "http://hooks.example.com/", method: "POST", body: new Uint8Array(2) })).toThrow(TypeError);
  });

  it("stops when the caller aborts", async () => {
    respond = () => undefined;
    const controller = new AbortController();

    const pending = publicHttpRequest({ url: "http://hooks.example.com:" + port + "/", method: "POST", body: "{}", lookup: toLoopback, signal: controller.signal });
    setTimeout(() => controller.abort(), 100);

    await expect(pending).rejects.toThrow();
  });
});
