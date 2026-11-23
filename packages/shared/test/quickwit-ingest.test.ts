import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { QUICKWIT_WRITE_STATE, QuickwitIngestError } from "../src/quickwit";
import { QuickwitService } from "../src/quickwit/service";

type Handler = (request: IncomingMessage, body: string, response: ServerResponse) => void;

const DOCUMENTS = [{ eventId: "a", message: "one" }, { eventId: "b", message: "two" }];

describe("QuickwitService.ingest against a stub server", () => {
  let server: Server;
  let handler: Handler;
  let requests: Array<{ url: string; body: string }>;

  async function start(): Promise<string> {
    server = createServer((request, response) => {
      let body = "";
      request.on("data", (chunk) => (body += chunk));
      request.on("end", () => {
        requests.push({ url: request.url ?? "", body });
        handler(request, body, response);
      });
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  }

  function serviceAt(url: string, timeoutMs = 2_000) {
    process.env.QUICKWIT_URL = url;
    process.env.QUICKWIT_TIMEOUT_MS = String(timeoutMs);
    return new QuickwitService();
  }

  beforeEach(() => {
    requests = [];
  });

  afterEach(async () => {
    await new Promise((resolve) => (server ? server.close(resolve) : resolve(undefined)));
    server = undefined as never;
    delete process.env.QUICKWIT_URL;
    delete process.env.QUICKWIT_TIMEOUT_MS;
  });

  it("asks for a detailed response and returns the counts", async () => {
    handler = (_request, _body, response) => {
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify({ num_docs_for_processing: 2, num_ingested_docs: 2, num_rejected_docs: 0 }));
    };

    const result = await serviceAt(await start()).ingest("telemetry-logs", DOCUMENTS);

    expect(result).toEqual({ received: 2, ingested: 2, rejected: [] });
    expect(requests[0]!.url).toBe("/api/v1/telemetry-logs/ingest?commit=auto&detailed_response=true");
    expect(requests[0]!.body.split("\n")).toEqual(DOCUMENTS.map((document) => JSON.stringify(document)));
  });

  it("reports rejected documents with their reasons on a 200", async () => {
    const rejected = JSON.stringify(DOCUMENTS[1]);
    handler = (_request, _body, response) => {
      response.setHeader("content-type", "application/json");
      response.end(
        JSON.stringify({
          num_docs_for_processing: 2,
          num_ingested_docs: 1,
          num_rejected_docs: 1,
          parse_failures: [{ message: "field `timestamp` is required", reason: "invalid_schema", document: rejected }],
        }),
      );
    };

    const result = await serviceAt(await start()).ingest("telemetry-logs", DOCUMENTS);

    expect(result.ingested).toBe(1);
    expect(result.rejected).toEqual([
      { document: rejected, reason: "invalid_schema", message: "field `timestamp` is required" },
    ]);
  });

  it("does not call Quickwit for an empty batch", async () => {
    const result = await serviceAt(await start()).ingest("telemetry-logs", []);

    expect(result).toEqual({ received: 0, ingested: 0, rejected: [] });
    expect(requests).toHaveLength(0);
  });

  it.each([400, 413, 429])("classifies a %s as definitely not written", async (status) => {
    handler = (_request, _body, response) => {
      response.statusCode = status;
      response.end("no");
    };

    const failure = await serviceAt(await start()).ingest("telemetry-logs", DOCUMENTS).catch((error) => error);

    expect(failure).toBeInstanceOf(QuickwitIngestError);
    expect(failure.writeState).toBe(QUICKWIT_WRITE_STATE.notWritten);
    expect(failure.status).toBe(status);
  });

  it.each([408, 500, 502, 503, 504])("classifies a %s as unknown", async (status) => {
    handler = (_request, _body, response) => {
      response.statusCode = status;
      response.end("maybe");
    };

    const failure = await serviceAt(await start()).ingest("telemetry-logs", DOCUMENTS).catch((error) => error);

    expect(failure.writeState).toBe(QUICKWIT_WRITE_STATE.unknown);
  });

  it("classifies a timeout after the request was received as unknown", async () => {
    handler = () => undefined;

    const failure = await serviceAt(await start(), 150).ingest("telemetry-logs", DOCUMENTS).catch((error) => error);

    expect(requests).toHaveLength(1);
    expect(failure).toBeInstanceOf(QuickwitIngestError);
    expect(failure.writeState).toBe(QUICKWIT_WRITE_STATE.unknown);
  });

  it("classifies a connection that is cut mid-request as unknown", async () => {
    handler = (request) => request.socket.destroy();

    const failure = await serviceAt(await start()).ingest("telemetry-logs", DOCUMENTS).catch((error) => error);

    expect(failure.writeState).toBe(QUICKWIT_WRITE_STATE.unknown);
  });

  it("classifies a refused connection as definitely not written", async () => {
    const probe = createServer();
    await new Promise<void>((resolve) => probe.listen(0, "127.0.0.1", resolve));
    const port = (probe.address() as AddressInfo).port;
    await new Promise((resolve) => probe.close(resolve));

    const failure = await serviceAt(`http://127.0.0.1:${port}`).ingest("telemetry-logs", DOCUMENTS).catch((error) => error);

    expect(failure.writeState).toBe(QUICKWIT_WRITE_STATE.notWritten);
    expect(failure.message).toMatch(/ECONNREFUSED/);
  });

  it("classifies a 200 with a body it cannot read as unknown", async () => {
    handler = (_request, _body, response) => response.end("not json");

    const failure = await serviceAt(await start()).ingest("telemetry-logs", DOCUMENTS).catch((error) => error);

    expect(failure.writeState).toBe(QUICKWIT_WRITE_STATE.unknown);
  });

  it("classifies a 200 whose counts are missing as unknown", async () => {
    handler = (_request, _body, response) => {
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify({ ok: true }));
    };

    const failure = await serviceAt(await start()).ingest("telemetry-logs", DOCUMENTS).catch((error) => error);

    expect(failure.writeState).toBe(QUICKWIT_WRITE_STATE.unknown);
  });

  it("classifies a 200 that hides the rejected documents as unknown", async () => {
    handler = (_request, _body, response) => {
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify({ num_docs_for_processing: 2, num_ingested_docs: 1, num_rejected_docs: 1 }));
    };

    const failure = await serviceAt(await start()).ingest("telemetry-logs", DOCUMENTS).catch((error) => error);

    expect(failure.writeState).toBe(QUICKWIT_WRITE_STATE.unknown);
  });
});
