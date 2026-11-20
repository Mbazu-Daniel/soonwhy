export interface WeeklySummaryStats {
  incidents: { total: number; active: number; resolved: number };
  notifications: { total: number; sent: number; failed: number };
}
