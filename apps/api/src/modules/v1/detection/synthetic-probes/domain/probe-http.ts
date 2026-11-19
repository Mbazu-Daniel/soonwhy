import http from "node:http";
import https from "node:https";
import { pinnedLookup } from "../../../../../common/net/pinned-lookup";
import type { ProbeHttpResult } from "./probe-http.types";

export { pinnedLookup };

export function httpProbe(
  urlString: string,
  options: {
    method: string;
    headers: Record<string, string>;
    body?: string | null;
    timeoutMs: number;
  },
): Promise<ProbeHttpResult> {
  const url = new URL(urlString);
  const client = url.protocol === "https:" ? https : http;
  const start = Date.now();

  return new Promise<ProbeHttpResult>((resolve, reject) => {
    const request = client.request(
      url,
      {
        method: options.method,
        headers: options.headers,
        lookup: pinnedLookup,
      },
      (response) => {
        response.on("data", () => {});
        response.on("end", () => {
          resolve({
            statusCode: response.statusCode ?? 0,
            responseTimeMs: Date.now() - start,
          });
        });
        response.on("error", reject);
        response.resume();
      },
    );

    request.setTimeout(options.timeoutMs, () => {
      request.destroy(new Error(`Request timeout after ${options.timeoutMs}ms`));
    });
    request.on("error", (error) => {
      reject(error);
    });

    if (options.body && options.method !== "GET" && options.method !== "HEAD") {
      request.write(options.body);
    }
    request.end();
  });
}
