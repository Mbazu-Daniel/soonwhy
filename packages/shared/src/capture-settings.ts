export interface CaptureSettings {
  redactSensitiveData: boolean;
  captureRequestHeaders: boolean;
  captureRequestBody: boolean;
  captureResponseBody: boolean;
  maxAttributeCount: number;
  maxAttributeValueLength: number;
}

export const DEFAULT_CAPTURE_SETTINGS: CaptureSettings = {
  redactSensitiveData: true,
  captureRequestHeaders: true,
  captureRequestBody: true,
  captureResponseBody: true,
  maxAttributeCount: 100,
  maxAttributeValueLength: 4096,
};

export function resolveCaptureSettings(
  raw: Partial<CaptureSettings> | undefined,
): CaptureSettings {
  return { ...DEFAULT_CAPTURE_SETTINGS, ...raw };
}
