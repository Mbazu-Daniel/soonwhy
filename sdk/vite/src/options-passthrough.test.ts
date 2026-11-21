import { describe, expect, it, vi } from "vitest";

const initNode = vi.hoisted(() => vi.fn());
vi.mock("@soonwhy/node", () => ({ initNode, shutdown: vi.fn() }));

import soonwhyVite from "./plugin.js";

describe("soonwhyVite", () => {
  it("hands every option, including body capture and dependency reporting, to the node SDK", () => {
    const options = { apiKey: "k", serviceName: "s", captureBodies: true, reportDependencies: { apiEndpoint: "http://api/v1" } };
    const server = { httpServer: { once: vi.fn() }, config: { logger: { warn: vi.fn() } } };
    (soonwhyVite(options).configureServer as (server: unknown) => void)(server);
    expect(initNode).toHaveBeenCalledWith(options);
  });
});
