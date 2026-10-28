export interface GetSLOInput {
  orgId: string;
  projectId: string;
  sloId?: string;
  from?: Date;
  to?: Date;
  window?: "1h" | "6h" | "24h" | "7d";
}

export interface SLOMetrics {
  /** SLO target (e.g., 0.99 for 99% availability) */
  target: number;
  /** Current measured value */
  current: number;
  /** Remaining error budget percentage */
  budgetRemaining: number;
  /** Consumed error budget percentage */
  budgetConsumed: number;
  /** Burn rate (actual / SLO target) */
  burnRate: number;
  /** Status: healthy | caution | critical */
  status: "healthy" | "caution" | "critical";
  /** Estimated time to exhaustion in hours */
  estimatedTimeToExhaustion?: number;
  /** Last updated timestamp */
  lastUpdated: Date;
}

export interface SLOWindow {
  start: Date;
  end: Date;
  targetErrorRate: number;
  actualErrorRate: number;
  errorCount: number;
  totalRequests: number;
}

export interface QueryErrorCountInput {
  orgId: string;
  projectId: string;
  from: string;
  to: string;
  interval?: string;
  service?: string;
}
