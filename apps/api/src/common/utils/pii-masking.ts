import { Injectable, Logger } from "@nestjs/common";

const PII_PATTERNS = [
  // Email addresses
  { pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, replacement: "[EMAIL]" },
  // Phone numbers (various formats)
  { pattern: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, replacement: "[PHONE]" },
  { pattern: /\+?\d{1,3}[- ]?\(?\d{3}\)?[- ]?\d{3}[- ]?\d{4}\b/g, replacement: "[PHONE]" },
  // Credit card numbers (basic pattern)
  { pattern: /\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/g, replacement: "[CARD]" },
  // SSN (US format)
  { pattern: /\b\d{3}[- ]?\d{2}[- ]?\d{4}\b/g, replacement: "[SSN]" },
  // IP addresses (may want to keep for debugging, but can mask)
  { pattern: /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, replacement: "[IP]" },
  // API keys/tokens (common patterns)
  { pattern: /\b[A-Za-z0-9]{32,}\b/g, replacement: "[TOKEN]" },
];

@Injectable()
export class PIIMaskingService {
  private readonly logger = new Logger(PIIMaskingService.name);

  maskText(text: string): string {
    let masked = text;

    for (const { pattern, replacement } of PII_PATTERNS) {
      masked = masked.replace(pattern, replacement);
    }

    return masked;
  }

  maskObject(obj: any): any {
    if (!obj || typeof obj !== "object") {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => {
        if (typeof item === "string") {
          return this.maskText(item);
        } else if (typeof item === "object" && item !== null) {
          return this.maskObject(item);
        }
        return item;
      });
    }

    const masked: any = {};
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === "string") {
        masked[key] = this.maskText(value);
      } else if (typeof value === "object" && value !== null) {
        masked[key] = this.maskObject(value);
      } else {
        masked[key] = value;
      }
    }

    return masked;
  }

  maskError(error: any): any {
    if (!error) return error;

    const masked = { ...error };

    if (error.message) {
      masked.message = this.maskText(error.message);
    }

    if (error.stack) {
      masked.stack = this.maskText(error.stack);
    }

    return masked;
  }

  maskEvidence(evidence: any): any {
    return this.maskObject(evidence);
  }
}
