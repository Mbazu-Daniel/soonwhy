export const AUTH_FAILURE_MIN_COUNT = 25;
export const AUTH_FAILURE_GROWTH_FACTOR = 3;
export const AUTH_FAILURE_CRITICAL_COUNT = 200;
export const AUTH_FAILURE_QUERY = "statusCode:401 OR statusCode:403";
export const SECRET_SCAN_MAX_LOGS = 2000;
export const SECRET_SAMPLE_LIMIT = 5;

export const SECRET_PATTERNS: ReadonlyArray<{ kind: string; pattern: RegExp }> = [
  { kind: "AWS access key", pattern: /\bAKIA[0-9A-Z]{16}\b/ },
  { kind: "GitHub token", pattern: /\bgh[pousr]_[A-Za-z0-9]{36,}\b/ },
  { kind: "Private key", pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  { kind: "Slack token", pattern: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/ },
  { kind: "Stripe live key", pattern: /\b[sr]k_live_[A-Za-z0-9]{16,}\b/ },
  { kind: "Bearer token", pattern: /\bBearer\s+[A-Za-z0-9\-._~+/]{20,}=*/ },
  { kind: "Password", pattern: /\b(?:password|passwd|secret|api[_-]?key)\s*[=:]\s*["']?(?!\[REDACTED\])[^\s"',;]{6,}/i },
];
