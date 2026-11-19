import type { DetectorSettingsService } from '../../detector-settings/application/detector-settings.service';
import type { DetectorSettings } from "./detection.stage.types";

export function detectorThresholds(
  detectorSettings: DetectorSettingsService,
  settings: DetectorSettings,
  detector: string,
  keys: string[],
): Record<string, number | undefined> {
  return Object.fromEntries(
    keys.map((key) => [key, detectorSettings.threshold(settings, detector, key)]),
  );
}
