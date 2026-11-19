import { DEFAULT_DAILY_CAP, DEFAULT_MIN_OCCURRENCES } from "./auto-analysis.constants";
import type { AutoAnalysisSettings } from "./auto-analysis.types";

export const DEFAULT_SETTINGS: AutoAnalysisSettings = {
  enabled: false,
  dailyCap: DEFAULT_DAILY_CAP,
  minOccurrences: DEFAULT_MIN_OCCURRENCES,
};
