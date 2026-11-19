import type { CaptureSettings } from "./capture-settings.types";

export const DEFAULT_CAPTURE_SETTINGS: CaptureSettings = {
  redactSensitiveData: true,
  captureRequestHeaders: true,
  captureRequestBody: true,
  captureResponseBody: true,
  maxAttributeCount: 100,
  maxAttributeValueLength: 4096,
};
