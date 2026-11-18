export interface AutoAnalysisSettings {
  enabled: boolean;
  dailyCap: number;
  minOccurrences: number;
}

export interface AutoAnalysisRun {
  analyzed: number;
  skipped: number;
  failed: number;
  capReached: boolean;
}
