import type { FindingCategory } from "../../../../../common/db/schema/finding-lifecycle";
import { CATEGORY_BY_TYPE } from "./finding-category.constants";

export function categoryOf(type: string): FindingCategory {
  return CATEGORY_BY_TYPE[type as keyof typeof CATEGORY_BY_TYPE] ?? "performance";
}
