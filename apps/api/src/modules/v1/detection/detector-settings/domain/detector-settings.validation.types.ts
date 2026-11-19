import { DETECTOR_DEFINITIONS, FEATURE_FLAG_DEFINITIONS, type DetectorConfigInput } from "./detector-settings.constants";

export type DetectorFeatureFlags = Record<string, boolean>;

export type DetectorSettingsSnapshot = {
  organizationId: string;
  detectors: Record<string, { enabled: boolean; thresholds: Record<string, number> }>;
  featureFlags: DetectorFeatureFlags;
  overrides: {
    detectors: Record<string, DetectorConfigInput>;
    featureFlags: Record<string, boolean>;
  };
  knownDetectors: typeof DETECTOR_DEFINITIONS;
  knownFeatureFlags: typeof FEATURE_FLAG_DEFINITIONS;
  updatedAt?: string;
};

export type DetectorSettingsPatch = {
  detectors?: Record<string, DetectorConfigInput>;
  featureFlags?: Record<string, boolean>;
};
