import { Injectable, Logger } from "@nestjs/common";
import { SyntheticProbesRepository } from "./synthetic-probes.repository";
import { CreateSyntheticProbeInput, UpdateSyntheticProbeInput } from "./dto";
import { URL } from "url";
import dns from "dns/promises";

const PRIVATE_IP_RANGES = [
  /^10\./,
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
  /^192\.168\./,
  /^127\./,
  /^0\./,
  /^::1$/,
  /^fc00:/i,
  /^fe80:/i,
];

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
    // Validate URL for SSRF protection before creating probe
    this.validateProbeUrl(input.url);
    return this.repository.createProbe(orgId, projectId, input);
  }

  private validateProbeUrl(urlString: string): void {
    try {
      const url = new URL(urlString);

      // Only allow HTTP/HTTPS
      if (!["http:", "https:"].includes(url.protocol)) {
        throw new Error(`Invalid protocol: ${url.protocol}`);
      }

      // Check for private IP in hostname
      if (this.isPrivateHostname(url.hostname)) {
        throw new Error(`Private IP or localhost detected: ${url.hostname}`);
      }

      // Check port
      const port = url.port ? parseInt(url.port, 10) : (url.protocol === "https:" ? 443 : 80);
      if (!ALLOWED_PORTS.includes(port)) {
        throw new Error(`Port ${port} not allowed`);
      }

      // Check for private IP in DNS resolution
      // Note: In production, this should use a DNS resolver that can reject private IPs
      // For now, we'll log a warning and continue
      this.logger.warn(`DNS resolution for ${url.hostname} should be validated for private IPs`);
    } catch (error) {
      this.logger.error(`URL validation failed for ${urlString}`, error);
      throw new Error(`Invalid probe URL: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private isPrivateHostname(hostname: string): boolean {
    // Check against private IP ranges
    for (const range of PRIVATE_IP_RANGES) {
      if (range.test(hostname)) return true;
    }
    // Check for localhost
    if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1") {
      return true;
    }
    return false;
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
    return this.repository.getProbes(orgId, projectId);
  }

  async getProbeById(id: number) {
    return this.repository.getProbeById(id);
  }

  async updateProbe(id: number, input: UpdateSyntheticProbeInput) {
    return this.repository.updateProbe(id, input);
  }

  async deleteProbe(id: number) {
    return this.repository.deleteProbe(id);
  }

  async getProbeResults(probeId: number, limit: number = 100) {
    return this.repository.getProbeResults(probeId, limit);
  }

  async executeProbe(probe: any) {
    // Re-validate URL before execution (defense in depth)
    this.validateProbeUrl(probe.url);

    const startTime = Date.now();
    let status = "up";
    let statusCode: number | null = null;
    let errorMessage: string | null = null;
    let responseTimeMs: number | null = null;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), probe.timeoutMs);

      // Sanitize headers to prevent credential leakage
      const sanitizedHeaders = this.sanitizeHeaders(probe.headers || {});

      const response = await fetch(probe.url, {
        method: probe.method,
        headers: sanitizedHeaders,
        body: probe.method !== "GET" && probe.method !== "HEAD" ? probe.body : undefined,
        signal: controller.signal,
        redirect: "manual", // Manually handle redirects to prevent downgrade attacks
      });

      clearTimeout(timeoutId);
      responseTimeMs = Date.now() - startTime;
      statusCode = response.status;

      // Check for HTTPS downgrade
      if (probe.url.startsWith("https://") && response.url && !response.url.startsWith("https://")) {
        status = "down";
        errorMessage = "HTTPS downgrade detected";
      } else if (response.status >= 500) {
        status = "down";
        errorMessage = `Server error: ${response.status}`;
      } else if (response.status >= 400) {
        status = "degraded";
        errorMessage = `Client error: ${response.status}`;
      } else if (response.status !== probe.expectedStatusCode) {
        status = "degraded";
        errorMessage = `Expected status ${probe.expectedStatusCode}, got ${response.status}`;
      }
    } catch (error: any) {
      responseTimeMs = Date.now() - startTime;
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

    // Update probe stats
    const results = await this.repository.getProbeResults(probe.id, 100);
    const totalChecks = results.length;
    const failedChecks = results.filter((r) => r.status === "down").length;
    const uptimePercent = totalChecks > 0 ? Math.round(((totalChecks - failedChecks) / totalChecks) * 100) : 100;

    await this.repository.updateProbeStats(probe.id, {
      lastStatus: status,
      uptimePercent,
      totalChecks,
      failedChecks,
      lastCheckAt: new Date(),
    });

    return { status, statusCode, responseTimeMs, errorMessage };
  }

  async runAllEnabledProbes() {
    const probes = await this.repository.getEnabledProbes();
    const results = await Promise.allSettled(
      probes.map((probe) => this.executeProbe(probe))
    );
    return {
      total: probes.length,
      succeeded: results.filter((r) => r.status === "fulfilled").length,
      failed: results.filter((r) => r.status === "rejected").length,
    };
  }
}
