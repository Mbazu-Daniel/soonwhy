import { SPAN_KIND_CLIENT, SPAN_KIND_PRODUCER } from "../../../common/telemetry/span-filters";

export const MAX_OPERATIONS = 100;
export const MAX_DEPENDENCIES = 50;
export const LATENCY_PERCENTS = [50, 95, 99];

export const DEPENDENCY_SPAN_FILTER = `(spanKind:${SPAN_KIND_CLIENT} OR spanKind:${SPAN_KIND_PRODUCER})`;
