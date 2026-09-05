import type { ParsedResource } from '../interfaces';

export type { ParsedResource };

export function resourceFromAttributes(
  resourceAttrs: Record<string, unknown>,
): ParsedResource {
  return {
    attributes: resourceAttrs,
    serviceName: getAttribute(resourceAttrs, 'service.name') || 'unknown_service',
    serviceVersion: getAttribute(resourceAttrs, 'service.version'),
    environment: getAttribute(
      resourceAttrs,
      'deployment.environment.name',
      'deployment.environment',
    ),
    region: getAttribute(resourceAttrs, 'cloud.region', 'host.region'),
  };
}

export function getAttribute(attrs: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const val = attrs[key];
    if (typeof val === 'string' && val) return val;
  }
  return '';
}

/** Accepts OTLP JSON hex ids or protobufjs `bytes: String` base64 ids. */
export function hexId(value: string, expectedLength: number): string {
  if (!value || typeof value !== 'string') return '';

  const normalized = value.toLowerCase();
  if (normalized.length === expectedLength && /^[0-9a-f]+$/.test(normalized)) {
    return /^0+$/.test(normalized) ? '' : normalized;
  }

  try {
    const bytes = Buffer.from(value, 'base64');
    const expectedBytes = expectedLength / 2;
    if (bytes.byteLength !== expectedBytes) return '';
    const hex = bytes.toString('hex');
    return /^0+$/.test(hex) ? '' : hex;
  } catch {
    return '';
  }
}
