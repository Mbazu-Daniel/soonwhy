import type { CaptureSettings } from "../capture-settings";

export interface ValidatedApiKey {
  projectId: string;
  organizationId: string;
  scopes: string[];
  captureSettings: CaptureSettings;
}
