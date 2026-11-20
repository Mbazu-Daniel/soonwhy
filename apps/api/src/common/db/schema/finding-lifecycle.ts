export const FINDING_STATUSES = ["open", "resolved", "ignored"] as const;
export const FINDING_CATEGORIES = ["error", "performance", "security", "vulnerability"] as const;

export type FindingStatus = (typeof FINDING_STATUSES)[number];
export type FindingCategory = (typeof FINDING_CATEGORIES)[number];
