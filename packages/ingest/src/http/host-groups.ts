import type { IngestItem } from "../pipeline/types";
import { HOST_NAME_ATTRIBUTE } from "./host-groups.constants";

export function hostNameOf(item: IngestItem): string {
  const resource = item.resource as { attributes?: Record<string, unknown> } | undefined;
  const value = resource?.attributes?.[HOST_NAME_ATTRIBUTE];
  return typeof value === "string" ? value.trim() : "";
}

export function groupByHost(items: IngestItem[]): Map<string, IngestItem[]> {
  const groups = new Map<string, IngestItem[]>();
  for (const item of items) {
    const name = hostNameOf(item);
    const group = groups.get(name);
    if (group) group.push(item);
    else groups.set(name, [item]);
  }
  return groups;
}
