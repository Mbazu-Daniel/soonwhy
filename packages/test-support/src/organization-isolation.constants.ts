import type { IsolationOperation } from "./organization-isolation.types";

export const ISOLATION_OPERATIONS: readonly IsolationOperation[] = ["list", "read", "create", "update", "delete"];
export const DENIED_STATUSES = new Set([401, 403, 404]);
export const DENIED_NAMES = new Set(["NotFoundException", "ForbiddenException", "UnauthorizedException"]);
