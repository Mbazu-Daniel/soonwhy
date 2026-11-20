import { encryptPii, encryptPiiInText } from "@soonwhy/shared";
import { PII_UNAVAILABLE_PLACEHOLDER } from "./pii-safe.constants";

export function encryptOrRedact(value: string): string {
  try {
    return encryptPii(value);
  } catch {
    return PII_UNAVAILABLE_PLACEHOLDER;
  }
}

export function encryptTextOrRedact(value: string): string {
  try {
    return encryptPiiInText(value);
  } catch {
    return PII_UNAVAILABLE_PLACEHOLDER;
  }
}
