const SENSITIVE_KEY = /(authorization|cookie|set-cookie|password|passwd|secret|token|api[_-]?key|access[_-]?key|private[_-]?key|credit[_-]?card|card[_-]?number|cvv|request\.body|response\.body|email|phone|address)/i;
const URL_WITH_QUERY = /https?:\/\/[^\s"'<>]+/gi;
const MAX_STRING_LENGTH = 500;

function sanitizeString(value: string): string {
  const redacted = value.replace(URL_WITH_QUERY, (url) => {
    try {
      const parsed = new URL(url);
      parsed.search = '';
      parsed.hash = '';
      return parsed.toString();
    } catch {
      return '[redacted-url]';
    }
  });

  return redacted.length > MAX_STRING_LENGTH
    ? redacted.slice(0, MAX_STRING_LENGTH) + '…'
    : redacted;
}

export function sanitizeRcaValue(value: unknown, key?: string): unknown {
  if (key && SENSITIVE_KEY.test(key)) return '[redacted]';

  if (typeof value === 'string') return sanitizeString(value);
  if (typeof value === 'number' || typeof value === 'boolean' || value === null) return value;

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeRcaValue(item));
  }

  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([entryKey, entryValue]) => [
        entryKey,
        sanitizeRcaValue(entryValue, entryKey),
      ]),
    );
  }

  return '[redacted]';
}

export function sanitizeRcaContext(context: unknown): Record<string, unknown> | undefined {
  if (!context || typeof context !== 'object' || Array.isArray(context)) return undefined;
  return sanitizeRcaValue(context) as Record<string, unknown>;
}
