export function sanitizeRequestUrl(value: string): string {
  try {
    return new URL(value).pathname;
  } catch {
    return value.split(/[?#]/, 1)[0] ?? '';
  }
}
