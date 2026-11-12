import http from "node:http";
import https from "node:https";
import dns from "node:dns";
import { isPublicIpAddress } from "./probe-ssrf";

export interface ProbeHttpResult {
  statusCode: number;
  responseTimeMs: number;
}

export function pinnedLookup(
  hostname: string,
  options: dns.LookupOptions,
  callback: (
    error: NodeJS.ErrnoException | null,
    address: string | dns.LookupAddress[],
    family?: number,
  ) => void,
): void {
  dns.lookup(hostname, { all: true, verbatim: true }, (error, addresses) => {
    if (error) {
      callback(error as NodeJS.ErrnoException, "", undefined);
      return;
    }
    if (addresses.length === 0) {
      callback(new Error(`DNS resolution failed for ${hostname}`), "", undefined);
      return;
    }
    for (const entry of addresses) {
      if (!isPublicIpAddress(entry.address)) {
        callback(
          new Error(
            `Private or reserved address ${entry.address} resolved for ${hostname}`,
          ),
          "",
          undefined,
        );
        return;
      }
    }
    if (options?.all) {
      callback(null, addresses);
      return;
    }
    const first = addresses[0]!;
    callback(null, first.address, first.family);
  });
}

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
