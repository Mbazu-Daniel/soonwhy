export const SENSITIVE_ATTRIBUTE_PATTERN =
  /authorization|cookie|set-cookie|password|passwd|secret|token|api[_-]?key|access[_-]?key|private[_-]?key|credit[_-]?card|card[_-]?number|cvv/i;

export const SENSITIVE_TEXT_PATTERNS = [
  /(authorization\s*[:=]\s*bearer\s+)[^\s,;]+/gi,
  /((?:password|passwd|token|api[_-]?key|access[_-]?key|secret|client[_-]?secret|private[_-]?key)\s*[:=]\s*)[^\s,;]+/gi,
  /((?:cookie|set-cookie)\s*[:=]\s*)[^\n]+/gi,
];
