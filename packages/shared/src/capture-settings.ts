import type { CaptureSettings } from "./capture-settings.types";
import { DEFAULT_CAPTURE_SETTINGS } from "./capture-settings.constants";

export function resolveCaptureSettings(
  raw: Partial<CaptureSettings> | undefined,
): CaptureSettings {
  return { ...DEFAULT_CAPTURE_SETTINGS, ...raw };
}
