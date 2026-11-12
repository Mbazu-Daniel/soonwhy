import { Injectable, Logger } from "@nestjs/common";
import { SyntheticProbesRepository } from "./synthetic-probes.repository";
import { CreateSyntheticProbeInput, UpdateSyntheticProbeInput } from "./dto";
import { URL } from "url";
import { isIP } from "node:net";
import { isPublicIpAddress, assertPublicDns } from "./probe-ssrf";
import { httpProbe } from "./probe-http";
import { computeProbeStatus, isProbeStale, type ProbeStatus } from "./probe-state";

const ALLOWED_PORTS = [80, 443, 8080, 3000, 3001, 5000, 8000, 8443];

const DENYLISTED_HEADERS = [
  "authorization",
  "cookie",
  "set-cookie",
  "proxy-authorization",
  "www-authenticate",
  "proxy-authenticate",
];

@Injectable()
export class SyntheticProbesService {
  private readonly logger = new Logger(SyntheticProbesService.name);

  constructor(private readonly repository: SyntheticProbesRepository) {}

  async createProbe(orgId: string, projectId: string, input: CreateSyntheticProbeInput) {
    this.validateProbeUrl(input.url);
    await assertPublicDns(new URL(input.url).hostname);
    return this.repository.createProbe(orgId, projectId, input);
  }

  private validateProbeUrl(urlString: string): void {
    let url: URL;
    try {
      url = new URL(urlString);
    } catch {
      throw new Error(`Invalid probe URL: ${urlString}`);
    }

    if (!["http:", "https:"].includes(url.protocol)) {
      throw new Error(`Invalid protocol: ${url.protocol}`);
    }

    if (url.username || url.password) {
      throw new Error("Probe URL must not embed credentials");
    }

    const hostname = url.hostname.replace(/^\[|\]$/g, "");
    if (isIP(hostname)) {
      if (!isPublicIpAddress(hostname)) {
        throw new Error(`Private or reserved address: ${hostname}`);
      }
    }

    const port = url.port
      ? parseInt(url.port, 10)
      : url.protocol === "https:"
        ? 443
        : 80;
    if (!ALLOWED_PORTS.includes(port)) {
      throw new Error(`Port ${port} not allowed`);
    }
  }

  private sanitizeHeaders(headers: Record<string, string>): Record<string, string> {
    const sanitized: Record<string, string> = {};
    for (const [key, value] of Object.entries(headers)) {
      const lowerKey = key.toLowerCase();
      if (!DENYLISTED_HEADERS.includes(lowerKey)) {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }

  async getProbes(orgId: string, projectId: string) {
    const probes = await this.repository.getProbes(orgId, projectId);
    return probes.map((probe) => this.withFreshStatus(probe));
  }

  async getProbeById(id: number) {
    const probe = await this.repository.getProbeById(id);
    return probe ? this.withFreshStatus(probe) : probe;
  }

  async updateProbe(id: number, input: UpdateSyntheticProbeInput) {
    if (input.url) {
      this.validateProbeUrl(input.url);
      await assertPublicDns(new URL(input.url).hostname);
    }
    return this.repository.updateProbe(id, input);
  }

  async deleteProbe(id: number) {
    return this.repository.deleteProbe(id);
  }

  async getProbeResults(probeId: number, limit: number = 100) {
    return this.repository.getProbeResults(probeId, limit);
  }

  async cleanupOldResults(daysOld: number = 30) {
    return this.repository.cleanupOldResults(daysOld);
  }

  async executeProbe(probe: any) {
    this.validateProbeUrl(probe.url);
    const hostname = new URL(probe.url).hostname;
    await assertPublicDns(hostname.replace(/^\[|\]$/g, ""));

    let status: ProbeStatus = "up";
    let statusCode: number | null = null;
    let errorMessage: string | null = null;
    let responseTimeMs: number | null = null;

    try {
      const result = await httpProbe(probe.url, {
        method: probe.method ?? "GET",
        headers: this.sanitizeHeaders(probe.headers || {}),
        body: probe.method !== "GET" && probe.method !== "HEAD" ? probe.body : undefined,
        timeoutMs: probe.timeoutMs,
      });

      responseTimeMs = result.responseTimeMs;
      statusCode = result.statusCode;

      if (result.statusCode >= 500) {
        status = "down";
        errorMessage = `Server error: ${result.statusCode}`;
      } else if (result.statusCode >= 400) {
        status = "degraded";
        errorMessage = `Client error: ${result.statusCode}`;
      } else if (result.statusCode !== probe.expectedStatusCode) {
        status = "degraded";
        errorMessage = `Expected status ${probe.expectedStatusCode}, got ${result.statusCode}`;
      }
    } catch (error: any) {
      responseTimeMs = null;
      status = "down";
      errorMessage = error.message || "Request failed";
      if (error.name === "AbortError") {
        errorMessage = `Request timeout after ${probe.timeoutMs}ms`;
      }
    }

    await this.repository.createResult(probe.id, {
      status,
      statusCode,
      responseTimeMs,
      errorMessage,
    });

    const recent = await this.repository.getProbeResults(probe.id, 3);
    const currentResult = recent[0];
    const lastStatus = computeProbeStatus(
      recent.map((result) => result.status),
      probe.lastStatus ?? null,
    );

    const results = await this.repository.getProbeResults(probe.id, 100);
    const totalChecks = results.length;
    const failedChecks = results.filter((r) => r.status !== "up").length;
    const uptimePercent =
      totalChecks > 0
        ? Math.round(((totalChecks - failedChecks) / totalChecks) * 100)
        : 100;

    await this.repository.updateProbeStats(probe.id, {
      lastStatus,
      uptimePercent,
      totalChecks,
      failedChecks,
      lastCheckAt: currentResult?.checkedAt ?? new Date(),
    });

    return { status, statusCode, responseTimeMs, errorMessage, lastStatus };
  }

  async runDueProbes() {
    const probes = await this.repository.getDueProbes();
    const results = await Promise.allSettled(
      probes.map((probe) => this.executeProbe(probe)),
    );
    const executed = results.filter((r) => r.status === "fulfilled").length;
    return {
      due: probes.length,
      executed,
      failed: probes.length - executed,
    };
  }

  withFreshStatus<T extends { lastStatus?: string | null; lastCheckAt?: Date | string | null; intervalSeconds?: number | null; enabled?: boolean }>(
    probe: T,
  ): T {
    if (probe.enabled === false) {
      return { ...probe, lastStatus: "unknown" };
    }
    if (isProbeStale(probe.lastCheckAt, probe.intervalSeconds ?? 60)) {
      return { ...probe, lastStatus: "unknown" };
    }
    return probe;
  }
}
