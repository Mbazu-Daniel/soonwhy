import { findingRow } from "../domain/finding-row";
import type { RaisedFinding } from "../domain/finding-row.types";
import { upsertFinding } from "./finding-upsert";

export function raiseFinding(input: RaisedFinding, seenAt?: Date) {
  return upsertFinding(findingRow(input), seenAt);
}
