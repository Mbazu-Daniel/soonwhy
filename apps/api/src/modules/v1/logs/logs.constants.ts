export const CORE_LOG_FIELDS = ["level", "service", "traceId", "spanId"] as const;
export const ATTRIBUTE_FIELD_PREFIX = "attributes.";
export const FIELD_SAMPLE_SIZE = 200;
export const MAX_FIELD_NAMES = 100;
export const MAX_FIELD_VALUES = 50;
export const MAX_RESULT_WINDOW = 10_000;
export const HISTOGRAM_TARGET_BUCKETS = 60;
export const HISTOGRAM_INTERVALS_SECONDS = [
  10, 30, 60, 300, 600, 1800, 3600, 10_800, 21_600, 43_200, 86_400,
] as const;
export const FIELD_NAME_PATTERN = /^[\w.\-:/]{1,128}$/;
export const CONTEXT_WINDOW_MS = 86_400_000;
export const MAX_CONTEXT_LINES = 50;
export const DEFAULT_CONTEXT_LINES = 10;
export const EXPORT_PAGE_SIZE = 1000;
export const DEFAULT_EXPORT_ROWS = 1000;
export const CSV_FORMULA_PREFIX = /^[=+\-@\t\r]/;
export const SAME_SECOND_LINES = 500;
