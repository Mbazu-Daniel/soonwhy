import type { Attributes, AttributeValue } from './types.js';

const SENSITIVE_KEY = /(authorization|cookie|set-cookie|password|passwd|secret|token|api[-_]?key|access[-_]?key|private[-_]?key|client[-_]?secret|session[-_]?id)/i;
const MAX_DEPTH = 6;

export interface SecurityOptions {
  redactSensitiveData: boolean;
  maxAttributeCount: number;
  maxAttributeValueLength: number;
}

export const DEFAULT_SECURITY_OPTIONS: SecurityOptions = {
  redactSensitiveData: true,
  maxAttributeCount: 100,
  maxAttributeValueLength: 4096,
};

export function sanitizeAttributes(attributes: Attributes | undefined, options: SecurityOptions): Attributes {
  if (!attributes) return {};
  const entries = Object.entries(attributes).slice(0, options.maxAttributeCount);
  return Object.fromEntries(entries.map(([key, value]) => [key, sanitizeValue(key, value, options, 0)]));
}

function sanitizeValue(key: string, value: AttributeValue, options: SecurityOptions, depth: number): AttributeValue {
  if (options.redactSensitiveData && SENSITIVE_KEY.test(key)) return '[REDACTED]';
  if (typeof value === 'string') return value.length > options.maxAttributeValueLength ? `${value.slice(0, options.maxAttributeValueLength)}…` : value;
  if (depth >= MAX_DEPTH) return '[TRUNCATED]';
  if (Array.isArray(value)) return value.map((item) => sanitizeValue(key, item, options, depth + 1));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).slice(0, options.maxAttributeCount).map(([childKey, childValue]) => [childKey, sanitizeValue(childKey, childValue, options, depth + 1)]));
  return value;
}

export function sanitizeMessage(message: string, options: SecurityOptions): string {
  return message.length > options.maxAttributeValueLength ? `${message.slice(0, options.maxAttributeValueLength)}…` : message;
}
