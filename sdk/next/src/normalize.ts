import {
  INTEGER_SEGMENT,
  LONG_HEX_SEGMENT,
  MAX_ROUTE_LENGTH,
  ULID_SEGMENT,
  UUID_SEGMENT,
} from "./constants.js";

export function normalizeNextRoute(pathname: string): string {
  const normalized = pathname
    .split("/")
    .map((segment) =>
      UUID_SEGMENT.test(segment) ||
      INTEGER_SEGMENT.test(segment) ||
      LONG_HEX_SEGMENT.test(segment) ||
      ULID_SEGMENT.test(segment)
        ? ":id"
        : segment,
    )
    .join("/");
  const route = normalized.startsWith("/") ? normalized : `/${normalized}`;
  return (route || "/").slice(0, MAX_ROUTE_LENGTH);
}
