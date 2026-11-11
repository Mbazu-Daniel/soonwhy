export interface PiiRule {
  pattern: RegExp;
  replacement: string;
}

export const PII_RULES: PiiRule[] = [
  {
    pattern: /\bBearer\s+[A-Za-z0-9._~+/=-]+/gi,
    replacement: "Bearer [REDACTED_TOKEN]",
  },
  {
    pattern: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g,
    replacement: "[REDACTED_TOKEN]",
  },
  {
    pattern:
      /\b(?:sk|pk|rk|ghp|gho|ghu|ghs|ghr|github_pat|xox[abprs])[-_][A-Za-z0-9_-]{10,}\b/g,
    replacement: "[REDACTED_TOKEN]",
  },
  {
    pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
    replacement: "[REDACTED_EMAIL]",
  },
  {
    pattern:
      /((?:password|passwd|secret|token|api[_-]?key|authorization)["']?\s*[:=]\s*)("[^"]*"|'[^']*'|[^\s,;&}]+)/gi,
    replacement: "$1[REDACTED]",
  },
];

export const SENSITIVE_KEY_PATTERN =
  /password|passwd|secret|token|api[_-]?key|authorization|credential/i;

export const REDACTED = "[REDACTED]";
