export const ERROR_LOG_LEVELS = ["error", "fatal"];
export const MAX_ERROR_HITS = 1000;
export const MAX_OCCURRENCES = 50;
export const MAX_TRACE_LINKS = 100;
export const TIMELINE_BUCKETS = 24;
export const DEFAULT_RANGE_MS = 86_400_000;
export const MAX_MESSAGE_LENGTH = 300;
export const FINGERPRINT_LENGTH = 16;
export const ERROR_FINDING_TYPE = "error_group";
export const ERROR_FINDING_MIN_OCCURRENCES = 2;
export const ERROR_FINDING_SYNC_LIMIT = 50;
export const HTTP_ERROR_FLOOR = 400;
export const HTTP_SERVER_ERROR_FLOOR = 500;
export const SPAN_ERROR_STATUS = 2;
export const MAX_APPLICATION_FRAMES = 5;
export const MAX_CAUSES = 3;
export const MAX_FRAME_LENGTH = 300;
export const CAUSE_MARKER = /^Caused by:\s*/;
export const LIBRARY_FRAME = /(?:^|[\\/])node_modules[\\/]|\bnode:|\binternal\//;
export const ERROR_ISSUE_STATES_LIMIT = 2000;
export const ERROR_FINGERPRINT_PATTERN = /^[0-9a-f]{16}$/;

export const REQUEST_LOG_MATCH_WINDOW_MS = 2000;

export const FINGERPRINT_FRAME_COUNT = 3;
export const FRAME_PATTERN = /^at\s+(?:(.*?)\s+\()?(.*?)\)?$/;
export const FRAME_POSITION_PATTERN = /(?::\d+){1,2}$/;

export const TRACE_EXCEPTION_MAX_SPANS = 200;
