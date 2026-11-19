export const SEARCH_AUDIT_ACTION = "search_audit_action";

const SEARCH_ACTIONS = ["logs.search", "logs.export", "traces.search"] as const;
export type SearchAction = (typeof SEARCH_ACTIONS)[number];
