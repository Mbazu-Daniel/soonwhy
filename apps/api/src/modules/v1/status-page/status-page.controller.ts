import { Controller, Get, Param, Query } from "@nestjs/common";
import { SyntheticProbesService } from "../synthetic-probes/synthetic-probes.service";
import { SyntheticProbesRepository } from "../synthetic-probes/synthetic-probes.repository";

@Controller("public/status")
export class StatusPageController {
  constructor(
    private readonly probesService: SyntheticProbesService,
    private readonly probesRepository: SyntheticProbesRepository,
  ) {}

  @Get(":orgId/:projectId")
  async getStatus(
    @Param("orgId") orgId: string,
    @Param("projectId") projectId: string,
  ) {
    const probes = await this.probesRepository.getProbes(orgId, projectId);
    
    const services = await Promise.all(
      probes.map(async (probe) => {
        const results = await this.probesRepository.getProbeResults(probe.id, 100);
        const totalChecks = results.length;
        const failedChecks = results.filter((r) => r.status === "down").length;
        const uptimePercent = totalChecks > 0 ? Math.round(((totalChecks - failedChecks) / totalChecks) * 100) : 100;
        
        // Calculate incidents
        const incidents: { start: string; end: string; duration: number }[] = [];
        let currentIncident: { start: string; end: string } | null = null;

        results.slice().reverse().forEach((result) => {
          if (!result.checkedAt) return;
          
          const checkedAtStr = new Date(result.checkedAt).toISOString();
          
          if (result.status === "down" || result.status === "degraded") {
            if (!currentIncident) {
              currentIncident = { start: checkedAtStr, end: checkedAtStr };
            } else {
              currentIncident.end = checkedAtStr;
            }
          } else {
            if (currentIncident) {
              const start = new Date(currentIncident.start).getTime();
              const end = new Date(currentIncident.end).getTime();
              incidents.push({
                start: currentIncident.start,
                end: currentIncident.end,
                duration: Math.round((end - start) / 1000 / 60),
              });
              currentIncident = null;
            }
          }
        });

        if (currentIncident) {
          const start = new Date((currentIncident as any).start).getTime();
          const end = new Date((currentIncident as any).end).getTime();
          incidents.push({
            start: (currentIncident as any).start,
            end: (currentIncident as any).end,
            duration: Math.round((end - start) / 1000 / 60),
          });
        }

        return {
          id: probe.id,
          name: probe.name,
          url: probe.url,
          status: probe.lastStatus,
          uptimePercent,
          totalChecks,
          failedChecks,
          lastCheckAt: probe.lastCheckAt,
          incidents,
        };
      }),
    );

    // Calculate overall status
    const overallStatus = services.some((s) => s.status === "down")
      ? "down"
      : services.some((s) => s.status === "degraded")
      ? "degraded"
      : "up";

    return {
      overallStatus,
      services,
      lastUpdated: new Date().toISOString(),
    };
  }
}
