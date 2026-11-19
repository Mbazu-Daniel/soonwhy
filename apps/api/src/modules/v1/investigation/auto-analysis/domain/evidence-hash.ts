import { createHash } from "node:crypto";
import { EVIDENCE_LABELS_THAT_DEFINE_A_CAUSE } from "./auto-analysis.constants";
import type { DetectionEvidence } from "../../../../../common/db/schema/findings";

export function evidenceHash(finding: { title: string; evidence: DetectionEvidence[] }): string {
  const parts = finding.evidence
    .filter((entry) => EVIDENCE_LABELS_THAT_DEFINE_A_CAUSE.some((label) => label.test(entry.label)))
    .map((entry) => `${entry.label}\u0000${String(entry.value)}`);
  return createHash("sha256")
    .update([finding.title, ...parts].join("\u0001"))
    .digest("hex");
}
