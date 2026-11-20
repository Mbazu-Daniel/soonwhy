export interface DetectionRunHealthRow {
  id: string;
  projectId: string;
  status: string;
  startedAt: Date;
  completedAt: Date | null;
  findingsCount: number;
  error: string | null;
}

export interface DetectionRunHealthEntry {
  id: string;
  projectId: string;
  status: string;
  startedAt: string;
  durationMs: number | null;
  findingsCount: number;
  error: string | null;
}

export interface DetectionHealthSummary {
  window: { from: string; to: string };
  totals: {
    runs: number;
    completed: number;
    failed: number;
    running: number;
    queued: number;
    findings: number;
    successRate: number | null;
    avgDurationMs: number | null;
    maxDurationMs: number | null;
  };
  lastRun: DetectionRunHealthEntry | null;
  recent: DetectionRunHealthEntry[];
}
