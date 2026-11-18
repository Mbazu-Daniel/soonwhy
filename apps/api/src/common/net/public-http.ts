import http from "node:http";
import https from "node:https";
import { pinnedLookup } from "./pinned-lookup";
import { assertPublicHttpUrlSyntax } from "./public-address";

export interface PublicHttpRequest {
  url: string;
  method?: string;
  headers?: HeadersInit;
  body?: unknown;
  signal?: AbortSignal;
  lookup?: typeof pinnedLookup;
}

export function publicHttpRequest(input: PublicHttpRequest): Promise<{ status: number }> {
  const url = assertPublicHttpUrlSyntax(input.url);
  if (input.body !== undefined && input.body !== null && typeof input.body !== "string") {
    throw new TypeError("A public HTTP request body must be a string");
  }
  const body = typeof input.body === "string" ? input.body : undefined;
  const headers = Object.fromEntries(new Headers(input.headers));
  if (body !== undefined) headers["content-length"] = String(Buffer.byteLength(body));
  const client = url.protocol === "https:" ? https : http;

  return new Promise((resolve, reject) => {
    const request = client.request(
      url,
      { method: input.method ?? "GET", headers, lookup: input.lookup ?? pinnedLookup, signal: input.signal },
      (response) => {
        response.on("error", reject);
        response.on("end", () => resolve({ status: response.statusCode ?? 0 }));
        response.resume();
      },
    );
    request.on("error", reject);
    if (body !== undefined) request.write(body);
    request.end();
  });
}
