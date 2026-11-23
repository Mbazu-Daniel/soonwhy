import type { SpanRecord } from "../types";
import type { Random } from "./rng";
import type { Distortion } from "./types";

function skewOffsets(spans: SpanRecord[], skewMs: number, random: Random): Map<string, number> {
  const offsets = new Map<string, number>();
  if (skewMs === 0) return offsets;
  for (const service of [...new Set(spans.map((span) => span.service))].sort()) {
    offsets.set(service, (random() * 2 - 1) * skewMs);
  }
  return offsets;
}

export function applyDistortion(spans: SpanRecord[], distortion: Distortion, random: Random): SpanRecord[] {
  const offsets = skewOffsets(spans, distortion.skewMs, random);
  const parents = new Set(spans.map((span) => span.parentSpanId).filter((id): id is string => id !== undefined));
  const kept: SpanRecord[] = [];
  for (const span of spans) {
    if (distortion.sampleDrop > 0 && random() < distortion.sampleDrop) continue;
    if (distortion.orphanRate > 0 && parents.has(span.spanId) && random() < distortion.orphanRate) continue;
    const offset = offsets.get(span.service) ?? 0;
    kept.push(offset === 0 ? span : { ...span, start: span.start + offset, end: span.end + offset });
  }
  return kept;
}
