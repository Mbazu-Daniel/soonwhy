import type { SecurityOptions } from "./security.types.js";

export const DEFAULT_SECURITY_OPTIONS: SecurityOptions = {
  redactSensitiveData: true,
  maxAttributeCount: 100,
  maxAttributeValueLength: 4096,
};
