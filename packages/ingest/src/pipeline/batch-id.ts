import { createHash } from "node:crypto";
import { generateEventId } from "@soonwhy/shared";
import type { BatchIdentity } from "./batch-id.types";

export function batchEventId(identity: BatchIdentity, items: readonly unknown[]): string {
  return generateEventId({
    ...identity,
    itemCount: items.length,
    contentHash: createHash("sha256").update(JSON.stringify(items)).digest("hex"),
  });
}
