export const SPAN_KIND_SERVER = 2;
export const SPAN_KIND_CLIENT = 3;
export const SPAN_KIND_PRODUCER = 4;
export const SPAN_KIND_CONSUMER = 5;
export const SPAN_ERROR_STATUS_CODE = 2;
export const MAX_OPERATIONS = 100;
export const MAX_DEPENDENCIES = 50;
export const LATENCY_PERCENTS = [50, 95, 99];

export const REQUEST_SPAN_FILTER = `(spanKind:${SPAN_KIND_SERVER} OR spanKind:${SPAN_KIND_CONSUMER} OR parentSpanId:"")`;
export const DEPENDENCY_SPAN_FILTER = `(spanKind:${SPAN_KIND_CLIENT} OR spanKind:${SPAN_KIND_PRODUCER})`;
export const ERROR_SPAN_FILTER = `statusCode:${SPAN_ERROR_STATUS_CODE}`;
