export const UUID_SEGMENT =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const INTEGER_SEGMENT = /^\d+$/;
export const LONG_HEX_SEGMENT = /^[0-9a-f]{16,}$/i;
export const ULID_SEGMENT = /^[0-9A-HJKMNP-TV-Z]{26}$/i;
export const DEFAULT_IGNORED_PREFIXES = ["/_next/", "/assets/"] as const;
export const DEFAULT_IGNORED_PATHS = ["/favicon.ico", "/robots.txt"] as const;
export const MAX_ROUTE_LENGTH = 256;
export const INSTRUMENTATION_NAME = "@soonwhy/next";
