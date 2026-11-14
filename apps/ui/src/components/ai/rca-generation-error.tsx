import { Link } from "@tanstack/react-router";
import { AlertCircle } from "lucide-react";
import { apiProblem } from "~/lib/api";

export function RcaGenerationError({
  error,
  orgSlug,
}: {
  error: unknown;
  orgSlug: string;
}) {
  const problem = apiProblem(error);
  const detail =
    problem.detail ??
    (error instanceof Error ? error.message : "RCA generation failed.");

  return (
    <div className="mt-3 flex items-start gap-2 rounded-lg border border-[#F8C7C2] bg-[#FDE8E6] px-3 py-2 text-sm text-[#8A1C13]">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="space-y-1">
        <p>{detail}</p>
        {problem.hint && (
          <p className="text-xs text-[#8A1C13]/80">{problem.hint}</p>
        )}
        {problem.code === "AI_NOT_CONFIGURED" && (
          <Link
            to="/$organizationSlug/ai"
            params={{ organizationSlug: orgSlug }}
            className="text-xs font-medium text-[#16931F] hover:underline"
          >
            Configure an AI provider
          </Link>
        )}
      </div>
    </div>
  );
}
