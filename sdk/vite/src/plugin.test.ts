import { once } from "node:events";
import http from "node:http";
import type { AddressInfo } from "node:net";
import type { ViteDevServer } from "vite";
import { afterEach, describe, expect, it, vi } from "vitest";
import soonwhyVite from "./plugin.js";
import { initNode, shutdown } from "@soonwhy/node";

const options = {
  apiKey: "soonwhy-vite-test-key",
  serviceName: "soonwhy-vite-test",
  environment: "test",
  endpoint: "http://localhost:9/v1",
  maxRetries: 0,
  flushIntervalMs: 0,
  registerShutdownHandlers: false,
} as const;

function fakeServer(
  httpServer: http.Server | null,
  logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
): { server: ViteDevServer; logger: typeof logger } {
  const server = {
    httpServer,
    config: { logger },
  } as unknown as ViteDevServer;
  return { server, logger };
}

afterEach(async () => {
  await shutdown();
});

describe("soonwhyVite", () => {
  it("does not start telemetry when the dev server has no httpServer", () => {
    const { server, logger } = fakeServer(null);
    const plugin = soonwhyVite({ ...options });

    expect(() =>
      (plugin.configureServer as (s: ViteDevServer) => void)(server),
    ).not.toThrow();
    expect(logger.warn).toHaveBeenCalledOnce();
  });

  it("starts telemetry on configureServer and flushes it on server close", async () => {
    const httpServer = http.createServer();
    httpServer.listen(0);
    await once(httpServer, "listening");
    const port = (httpServer.address() as AddressInfo).port;
    expect(port).toBeGreaterThan(0);

    const { server } = fakeServer(httpServer);
    const plugin = soonwhyVite({ ...options });

    (plugin.configureServer as (s: ViteDevServer) => void)(server);

    const client = initNode({ ...options });
    expect(client.isStarted()).toBe(true);

    httpServer.close();
    await once(httpServer, "close");

    await vi.waitFor(() => {
      expect(client.isStarted()).toBe(false);
    });
  }, 30_000);
});
