export const ALL_ORGANIZATIONS = "all-organizations" as const;

export type DlqScope = typeof ALL_ORGANIZATIONS | { organizationId: string };
