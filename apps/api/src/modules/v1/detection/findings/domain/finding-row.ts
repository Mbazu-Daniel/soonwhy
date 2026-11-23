import { categoryOf, recommendationFor } from "./finding-kind";
import { findingFingerprint } from "./finding-fingerprint";
import type { RaisedFinding } from "./finding-row.types";

export function findingRow(input: RaisedFinding) {
  const { key, category, recommendation, ...rest } = input;
  return {
    ...rest,
    category: category ?? categoryOf(input.type),
    fingerprint: findingFingerprint(input.type, input.serviceName, key),
    recommendation: recommendation === undefined ? recommendationFor(input.type, input.title) : recommendation,
  };
}
