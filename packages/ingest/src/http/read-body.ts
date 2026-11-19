import type { Request } from "express";
import { gunzipSync } from "zlib";
import { MAX_INGEST_BODY_BYTES, MAX_INGEST_DECODED_BYTES } from "../pipeline/constants";
import { PayloadTooLargeError } from "./payload-too-large.error";

export async function readLimitedBody(req: Request, contentEncoding: string | undefined): Promise<Buffer> {
  const declared = Number(req.headers?.["content-length"]);
  if (Number.isFinite(declared) && declared > MAX_INGEST_BODY_BYTES) throw new PayloadTooLargeError();
  const chunks: Buffer[] = [];
  let received = 0;
  for await (const chunk of req) {
    received += chunk.length;
    if (received > MAX_INGEST_BODY_BYTES) throw new PayloadTooLargeError();
    chunks.push(chunk);
  }
  const body = Buffer.concat(chunks);
  if (contentEncoding !== "gzip") return body;
  try {
    return gunzipSync(body, { maxOutputLength: MAX_INGEST_DECODED_BYTES });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ERR_BUFFER_TOO_LARGE") throw new PayloadTooLargeError();
    throw error;
  }
}
