import { Injectable } from "@nestjs/common";
import { SyntheticProbesRepository } from "./synthetic-probes.repository";
import { CreateSyntheticProbeInput, UpdateSyntheticProbeInput } from "./dto";

@Injectable()
export class SyntheticProbesService {
  constructor(private readonly repository: SyntheticProbesRepository) {}

  async createProbe(orgId: string, projectId: string, input: CreateSyntheticProbeInput) {
    return this.repository.createProbe(orgId, projectId, input);
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
    const startTime = Date.now();
    let status = "up";
    let statusCode: number | null = null;
    let errorMessage: string | null = null;
    let responseTimeMs: number | null = null;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), probe.timeoutMs);

      const response = await fetch(probe.url, {
        method: probe.method,
        headers: probe.headers,
        body: probe.method !== "GET" && probe.method !== "HEAD" ? probe.body : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      responseTimeMs = Date.now() - startTime;
      statusCode = response.status;

      if (response.status !== probe.expectedStatusCode) {
        status = "degraded";
        errorMessage = `Expected status ${probe.expectedStatusCode}, got ${response.status}`;
      }

      if (response.status >= 500) {
        status = "down";
        errorMessage = `Server error: ${response.status}`;
      } else if (response.status >= 400) {
        status = "degraded";
        errorMessage = `Client error: ${response.status}`;
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
