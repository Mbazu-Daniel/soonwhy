export type ConcurrencySnapshot = {
  limit: number;
  perOrganizationLimit: number;
  inFlight: number;
  available: number;
  isSaturated: boolean;
  organizations: number;
};
