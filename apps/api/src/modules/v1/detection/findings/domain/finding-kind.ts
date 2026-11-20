import type { FindingCategory } from "../../../../../common/db/schema/finding-lifecycle";
import { FINDING_KINDS } from "./finding-kinds.constants";

export function categoryOf(type: string): FindingCategory {
  return FINDING_KINDS[type as keyof typeof FINDING_KINDS]?.category ?? "performance";
}

export function recommendationFor(type: string): string | null {
  return FINDING_KINDS[type as keyof typeof FINDING_KINDS]?.recommendation ?? null;
}
