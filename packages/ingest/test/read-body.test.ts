import { Readable } from "stream";
import { gzipSync } from "zlib";
import type { Request } from "express";
import { describe, expect, it } from "vitest";
import { MAX_INGEST_BODY_BYTES, MAX_INGEST_DECODED_BYTES } from "../src/pipeline/constants";
import { PayloadTooLargeError } from "../src/http/payload-too-large.error";
import { readLimitedBody } from "../src/http/read-body";

function request(body: Buffer, headers: Record<string, string> = {}): Request {
  return Object.assign(Readable.from([body]), { headers }) as unknown as Request;
}

describe("readLimitedBody", () => {
  it("returns small plain and gzip bodies", async () => {
    const plain = Buffer.from('{"a":1}');
    expect((await readLimitedBody(request(plain), undefined)).toString()).toBe('{"a":1}');
    expect((await readLimitedBody(request(gzipSync(plain)), "gzip")).toString()).toBe('{"a":1}');
  });

  it("rejects a declared length over the limit", async () => {
    const req = request(Buffer.alloc(10), { "content-length": String(MAX_INGEST_BODY_BYTES + 1) });
    await expect(readLimitedBody(req, undefined)).rejects.toBeInstanceOf(PayloadTooLargeError);
  });

  it("rejects a streamed body over the limit", async () => {
    await expect(readLimitedBody(request(Buffer.alloc(MAX_INGEST_BODY_BYTES + 1)), undefined)).rejects.toBeInstanceOf(
      PayloadTooLargeError,
    );
  });

  it("rejects a gzip body that inflates past the limit", async () => {
    const bomb = gzipSync(Buffer.alloc(MAX_INGEST_DECODED_BYTES + 1));
    expect(bomb.length).toBeLessThan(MAX_INGEST_BODY_BYTES);
    await expect(readLimitedBody(request(bomb), "gzip")).rejects.toBeInstanceOf(PayloadTooLargeError);
  });
});
