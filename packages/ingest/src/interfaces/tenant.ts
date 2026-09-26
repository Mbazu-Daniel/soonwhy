export interface CaptureSettings {
  redactSensitiveData: boolean;
  captureRequestHeaders: boolean;
  captureRequestBody: boolean;
  captureResponseBody: boolean;
  maxAttributeCount: number;
  maxAttributeValueLength: number;
}

export interface TenantContext {
  projectId: string;
  organizationId: string;
  captureSettings: CaptureSettings;
}
