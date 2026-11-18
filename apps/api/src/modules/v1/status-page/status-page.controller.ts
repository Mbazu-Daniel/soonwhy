import { Controller, Get, Param } from "@nestjs/common";
import { SyntheticProbesService } from "../synthetic-probes/synthetic-probes.service";
import { SyntheticProbesRepository } from "../synthetic-probes/synthetic-probes.repository";
import { resolveStatusTarget } from "./resolve-status-target";

@Controller("public/status")
export class StatusPageController {
  constructor(
    private readonly probesService: SyntheticProbesService,
    private readonly probesRepository: SyntheticProbesRepository,
  ) {}

  @Get(":orgSlug/:projectSlug")
  async getStatus(
    @Param("orgSlug") orgSlug: string,
    @Param("projectSlug") projectSlug: string,
  ) {
    const { orgId, projectId } = await resolveStatusTarget(orgSlug, projectSlug);
    const probes = (await this.probesRepository.getProbes(orgId, projectId)).filter(
      (probe) => probe.enabled,
    );

    const resultsByProbe = await this.probesRepository.getRecentResultsForProbes(
      probes.map((probe) => probe.id),
      100,
    );

    const services = await Promise.all(
      probes.map(async (probe) => {
        const fresh = this.probesService.withFreshStatus(probe);
        const results = resultsByProbe.get(probe.id) ?? [];
        const totalChecks = results.length;
        const failedChecks = results.filter((r) => r.status === "down").length;
        const uptimePercent = totalChecks > 0 ? Math.round(((totalChecks - failedChecks) / totalChecks) * 100) : 100;
        
        const incidents: { start: string; end: string; duration: number }[] = [];
        let currentIncident: { start: string; end: string } | null = null;

        for (const result of results.slice().reverse()) {
          if (!result.checkedAt) continue;

          const checkedAtStr = new Date(result.checkedAt).toISOString();

          if (result.status === "down" || result.status === "degraded") {
            currentIncident = currentIncident
              ? { start: currentIncident.start, end: checkedAtStr }
              : { start: checkedAtStr, end: checkedAtStr };
          } else if (currentIncident) {
            incidents.push(closedIncident(currentIncident));
            currentIncident = null;
          }
        }

        if (currentIncident) incidents.push(closedIncident(currentIncident));

        return {
          name: probe.name,
          status: fresh.lastStatus,
          uptimePercent,
          totalChecks,
          failedChecks,
          lastCheckAt: probe.lastCheckAt,
          incidents,
        };
      }),
    );

    const overallStatus = services.some((s) => s.status === "down")
      ? "down"
      : services.some((s) => s.status === "degraded")
      ? "degraded"
      : services.some((s) => s.status === "unknown")
      ? "unknown"
      : "up";

    return {
      overallStatus,
      services,
      lastUpdated: new Date().toISOString(),
    };
  }
}

function closedIncident(incident: { start: string; end: string }) {
  const start = new Date(incident.start).getTime();
  const end = new Date(incident.end).getTime();
  return {
    start: incident.start,
    end: incident.end,
    duration: Math.round((end - start) / 1000 / 60),
  };
}
