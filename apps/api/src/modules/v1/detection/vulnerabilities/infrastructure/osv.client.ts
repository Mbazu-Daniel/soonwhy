import { Injectable } from "@nestjs/common";
import { OSV_BATCH_SIZE, OSV_DEFAULT_URL, OSV_DETAIL_CONCURRENCY, OSV_REQUEST_TIMEOUT_MS } from "../domain/vulnerability.constants";
import type { AdvisoryMatch, Ecosystem, OsvAdvisory, PackageRef } from "../domain/vulnerability.types";

interface BatchResponse {
  results?: Array<{ vulns?: Array<{ id: string }> }>;
}

@Injectable()
export class OsvClient {
  private readonly baseUrl = (process.env.VULNERABILITY_DATABASE_URL ?? OSV_DEFAULT_URL).replace(/\/+$/, "");

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(OSV_REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`Vulnerability database answered ${response.status}`);
    return (await response.json()) as T;
  }

  async queryBatch(ecosystem: Ecosystem, packages: PackageRef[]): Promise<AdvisoryMatch[]> {
    const matches: AdvisoryMatch[] = [];
    for (let start = 0; start < packages.length; start += OSV_BATCH_SIZE) {
      const chunk = packages.slice(start, start + OSV_BATCH_SIZE);
      const body = {
        queries: chunk.map((pkg) => ({ package: { name: pkg.name, ecosystem }, version: pkg.version })),
      };
      const response = await this.request<BatchResponse>("/v1/querybatch", { method: "POST", body: JSON.stringify(body) });
      const results = response.results ?? [];
      if (results.length !== chunk.length) throw new Error("Vulnerability database returned an incomplete answer");
      chunk.forEach((pkg, index) => {
        for (const vuln of results[index]?.vulns ?? []) matches.push({ pkg, advisoryId: vuln.id });
      });
    }
    return matches;
  }

  async advisories(ids: string[]): Promise<Map<string, OsvAdvisory>> {
    const found = new Map<string, OsvAdvisory>();
    const queue = [...ids];
    const worker = async () => {
      for (let id = queue.shift(); id !== undefined; id = queue.shift()) {
        found.set(id, await this.request<OsvAdvisory>(`/v1/vulns/${encodeURIComponent(id)}`));
      }
    };
    await Promise.all(Array.from({ length: Math.min(OSV_DETAIL_CONCURRENCY, queue.length) }, worker));
    return found;
  }
}
