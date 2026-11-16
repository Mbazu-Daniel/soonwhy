import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { UnauthorizedException } from "@nestjs/common";
import { IngestController } from "./controller";

const target = {
  projectId: "p1",
  organizationId: "o1",
  scopes: ["ingest"],
  captureSettings: {},
};

function build(resolved: unknown) {
  const apiKeys = { authenticate: vi.fn().mockResolvedValue({ ok: false, reason: "missing", message: "Missing or invalid API key" }) };
  const hostTarget = { resolve: vi.fn().mockResolvedValue(resolved) };
  const stats = {
    beginRequest: vi.fn(),
    endRequest: vi.fn(),
    recordAccepted: vi.fn(),
    recordRejected: vi.fn(),
    recordLatency: vi.fn(),
    recordError: vi.fn(),
    recordPublished: vi.fn(),
  };
  const controller = new IngestController(
    apiKeys as never,
    hostTarget as never,
    { checkRateLimit: vi.fn().mockResolvedValue(true) } as never,
    { publishWithAck: vi.fn().mockResolvedValue(true) } as never,
    stats as never,
    { tryAcquire: vi.fn().mockReturnValue(true), release: vi.fn() } as never,
  );
  return { controller, apiKeys, hostTarget };
}

function request(localPort: number) {
  const body = Buffer.from(JSON.stringify({ resourceMetrics: [] }));
  return { socket: { localPort }, [Symbol.asyncIterator]: async function* () { yield body; } } as never;
}

function response() {
  const res: any = { statusCode: 0, body: undefined as unknown };
  res.status = (code: number) => { res.statusCode = code; return res; };
  res.json = (value: unknown) => { res.body = value; return res; };
  res.end = () => res;
  res.setHeader = vi.fn();
  return res;
}

describe("host metrics on the internal port", () => {
  beforeEach(() => {
    vi.stubEnv("INGEST_PORT", "3002");
    vi.stubEnv("INGEST_INTERNAL_PORT", "3003");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("accepts metrics without a key and uses the configured project", async () => {
    const { controller, apiKeys, hostTarget } = build(target);
    const res = response();
    await controller.metric(request(3003), res, "application/json", undefined as never, undefined as never);
    expect(res.statusCode).toBe(200);
    expect(hostTarget.resolve).toHaveBeenCalled();
    expect(apiKeys.authenticate).not.toHaveBeenCalled();
  });

  it("asks the sender to retry when the project lookup fails, instead of dropping the batch", async () => {
    const { controller, hostTarget } = build(target);
    hostTarget.resolve.mockRejectedValue(new Error('relation "platform_settings" does not exist'));
    const res = response();
    await controller.metric(request(3003), res, "application/json", undefined as never, undefined as never);
    expect(res.statusCode).toBe(503);
    expect(res.setHeader).toHaveBeenCalledWith("Retry-After", "5");
  });

  it("says so when there is no project to file host metrics under", async () => {
    const { controller } = build(undefined);
    const res = response();
    await controller.metric(request(3003), res, "application/json", undefined as never, undefined as never);
    expect(res.statusCode).toBe(503);
    expect(JSON.stringify(res.body)).toContain("No project exists");
  });

  it("does not accept traces or logs without a key on the internal port", async () => {
    const { controller, hostTarget } = build(target);
    const res = response();
    await controller.trace(request(3003), res, "application/json", undefined as never, undefined as never);
    expect(res.statusCode).toBe(404);
    expect(hostTarget.resolve).not.toHaveBeenCalled();
  });

  it("still requires a key on the public port", async () => {
    const { controller, hostTarget } = build(target);
    await expect(
      controller.metric(request(3002), response(), "application/json", undefined as never, undefined as never),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(hostTarget.resolve).not.toHaveBeenCalled();
  });

  it("still requires a key on the public port when the internal port is off", async () => {
    vi.stubEnv("INGEST_INTERNAL_PORT", "");
    const { controller, hostTarget } = build(target);
    await expect(
      controller.metric(request(3003), response(), "application/json", undefined as never, undefined as never),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(hostTarget.resolve).not.toHaveBeenCalled();
  });
});
