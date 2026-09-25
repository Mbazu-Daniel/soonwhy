export function decodeAttributes(raw: unknown): Record<string, unknown> {
  const attrs: Record<string, unknown> = {};
  if (!Array.isArray(raw)) return attrs;
  for (const attr of raw) {
    const key = attr?.key;
    if (!key) continue;
    const val = attr.value;
    if (!val) continue;
    if (val.stringValue !== undefined) attrs[key] = val.stringValue;
    else if (val.intValue !== undefined) attrs[key] = Number(val.intValue);
    else if (val.doubleValue !== undefined) attrs[key] = val.doubleValue;
    else if (val.boolValue !== undefined) attrs[key] = val.boolValue;
    else if (val.arrayValue?.values) {
      attrs[key] = val.arrayValue.values.map(
        (v: { stringValue?: unknown; intValue?: unknown; doubleValue?: unknown; boolValue?: unknown }) =>
          v.stringValue ?? v.intValue ?? v.doubleValue ?? v.boolValue ?? '',
      );
    } else if (val.kvlistValue?.values) {
      attrs[key] = decodeAttributes(val.kvlistValue.values);
    }
  }
  return attrs;
}
