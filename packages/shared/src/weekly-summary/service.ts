import { Injectable } from "@nestjs/common";
import type { WeeklySummaryServiceDeps } from "./types";

@Injectable()
export class WeeklySummaryService {
  constructor(private readonly deps: WeeklySummaryServiceDeps) {}

  async dispatchWeeklySummary(input: {
    from: string;
    to: string;
    summary: Record<string, string>;
  }) {
    const { from, to, summary } = input;
    const fromDate = new Date(from);
    const toDate = new Date(to);

    const projects = await this.deps.getProjectsWithActiveChannels();

    const results: {
      projectId: string;
      orgId: string;
      sent: number;
      failed: number;
      results: unknown[];
    }[] = [];
    for (const { projectId, orgId } of projects) {
      const result = await this.deps.dispatchAlert({
        orgId,
        projectId,
        incidentId: "weekly-summary",
        severity: "medium",
        title: "Weekly Summary — Soonwhy",
        body:
          `Weekly incident and notification summary for ${fromDate.toDateString()} → ${toDate.toDateString()}\n` +
          `See attached summary for details.`,
        htmlBody: `
          <h2>Weekly Summary — Soonwhy</h2>
          <p><strong>Period:</strong> ${fromDate.toDateString()} → ${toDate.toDateString()}</p>
          <pre>${JSON.stringify(summary, null, 2)}</pre>
        `,
        metadata: { summary, period: { from, to } },
      });
      results.push({
        projectId,
        orgId,
        sent: result.sent,
        failed: result.failed,
        results: result.results,
      });
    }

    return { dispatched: results.length, results };
  }
}
