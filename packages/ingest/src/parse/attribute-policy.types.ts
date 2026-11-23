import type { CaptureSettings } from "../interfaces";

export type AttributeLimits = Pick<CaptureSettings, "maxAttributeCount" | "maxAttributeValueLength">;
