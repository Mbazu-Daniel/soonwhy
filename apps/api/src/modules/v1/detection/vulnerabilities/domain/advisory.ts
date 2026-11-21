import type { FindingSeverity } from "../../detections/domain/detection.types";
import { lowestUpgrade } from "./version-compare";
import { CRITICAL_SEVERITIES, MAX_DESCRIPTION_CHARS, VULNERABILITY_FINDING_TYPE } from "./vulnerability.constants";
import type { OsvAdvisory, PackageRef } from "./vulnerability.types";

export function advisorySeverity(advisory: OsvAdvisory): FindingSeverity {
  const label = advisory.database_specific?.severity?.toUpperCase() ?? "";
  return CRITICAL_SEVERITIES.has(label) ? "critical" : "warning";
}

export function fixedVersions(advisory: OsvAdvisory, pkg: PackageRef): string[] {
  const fixed = new Set<string>();
  for (const affected of advisory.affected ?? []) {
    if (affected.package?.name !== pkg.name) continue;
    for (const range of affected.ranges ?? []) {
      for (const event of range.events ?? []) if (event.fixed) fixed.add(event.fixed);
    }
  }
  return [...fixed];
}

export function advisoryRecommendation(pkg: PackageRef, fixed: string[]): string {
  const target = lowestUpgrade(pkg.version, fixed);
  if (!target) {
    return `No newer fixed version of ${pkg.name} is published. Replace the package or follow the workaround in the advisory.`;
  }
  return `Upgrade ${pkg.name} from ${pkg.version} to ${target} or later, then redeploy and rescan.`;
}

export function vulnerabilityFingerprint(serviceName: string, pkg: PackageRef, advisoryId: string): string {
  return [VULNERABILITY_FINDING_TYPE, serviceName, `${pkg.name}@${pkg.version}`, advisoryId].join(":");
}

export function advisoryTitle(advisory: OsvAdvisory, pkg: PackageRef): string {
  return `${advisory.id} in ${pkg.name}@${pkg.version}${advisory.summary ? `: ${advisory.summary}` : ""}`;
}

export function advisoryDescription(advisory: OsvAdvisory): string {
  const text = (advisory.details ?? advisory.summary ?? "No description published.").trim();
  return text.length > MAX_DESCRIPTION_CHARS ? `${text.slice(0, MAX_DESCRIPTION_CHARS)}…` : text;
}
