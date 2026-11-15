import type { CaptureSettings } from "../capture-settings";

export interface ValidatedApiKey {
  projectId: string;
  organizationId: string;
  scopes: string[];
  captureSettings: CaptureSettings;
}

export type ApiKeyAuthentication =
  | { ok: true; key: ValidatedApiKey }
  | { ok: false; reason: "missing" | "invalid" | "scope"; message: string };
