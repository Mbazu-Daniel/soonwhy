import { Link } from '@tanstack/react-router';
import { Card, CardContent } from '~/components/ui/card';
import { costShare, formatTokens, formatUsd, projectTokens } from '~/lib/ai-spend';
import type { ProjectSpend } from '~/lib/ai-spend.types';

interface ProjectSpendCardProps {
  organizationSlug: string;
  projects: ProjectSpend[];
  periodPhrase: string;
}

export function ProjectSpendCard({ organizationSlug, projects, periodPhrase }: ProjectSpendCardProps) {
  return (
    <Card className="rounded-xl border-[#242426] bg-[#0B0B0C]">
      <CardContent className="p-5">
        <h2 className="text-sm font-semibold text-[#F6F6F6]">Spend by project</h2>
        <p className="mt-1 text-xs text-[#989898]">
          Estimated from list prices for analysis runs and investigation chat. A model with no known price adds tokens but no cost.
        </p>
        {projects.length === 0 ? (
          <p className="mt-4 text-sm text-[#989898]">No project used AI {periodPhrase}.</p>
        ) : (
          <table className="mt-4 w-full text-sm">
            <thead>
              <tr className="text-left font-mono text-[10px] uppercase tracking-[0.14em] text-[#6E6E70]">
                <th className="pb-2 font-normal">Project</th>
                <th className="pb-2 text-right font-normal">Runs</th>
                <th className="pb-2 text-right font-normal">Tokens</th>
                <th className="pb-2 text-right font-normal">Estimated cost</th>
                <th className="w-32 pb-2 pl-4 font-normal">Share</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1B1B1D]">
              {projects.map((project) => {
                const share = Math.round(costShare(project, projects) * 100);
                return (
                  <tr key={project.projectId}>
                    <td className="py-2.5">
                      <Link
                        to="/$organizationSlug/p/$projectSlug"
                        params={{ organizationSlug, projectSlug: project.slug }}
                        className="font-medium text-[#F6F6F6] hover:underline"
                      >
                        {project.name}
                      </Link>
                    </td>
                    <td className="py-2.5 text-right tabular-nums">{project.runs}</td>
                    <td className="py-2.5 text-right tabular-nums">{formatTokens(projectTokens(project))}</td>
                    <td className="py-2.5 text-right tabular-nums">{formatUsd(project.costUsd)}</td>
                    <td className="py-2.5 pl-4">
                      <div className="h-1.5 w-full rounded-full bg-[#1B1B1D]" role="img" aria-label={`${share} percent of spend`}>
                        <div className="h-full rounded-full bg-[#ACFC15]" style={{ width: `${share}%` }} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}
