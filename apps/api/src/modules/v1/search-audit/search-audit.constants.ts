export const SEARCH_AUDIT_ACTION = "search_audit_action";

export const SEARCH_ACTIONS = ["logs.search", "logs.export", "traces.search"] as const;
export type SearchAction = (typeof SEARCH_ACTIONS)[number];
