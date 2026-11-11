export function positiveInt(
  value: string | undefined,
  fallback: number,
): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function chunkItems<T>(items: readonly T[], size: number): T[][] {
  const limit = Math.max(1, Math.floor(size));
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += limit)
    chunks.push(items.slice(index, index + limit));
  return chunks;
}

export function chunkItemsBySize<T>(
  items: readonly T[],
  maxItems: number,
  maxBytes: number,
  encode: (item: T) => Uint8Array,
): T[][] {
  const limit = Math.max(1, Math.floor(maxItems));
  const byteLimit = Math.max(1, Math.floor(maxBytes));
  const chunks: T[][] = [];
  let current: T[] = [];
  let currentBytes = 0;

  for (const item of items) {
    const size = encode(item).byteLength + 1;
    if (current.length > 0 && (current.length >= limit || currentBytes + size > byteLimit)) {
      chunks.push(current);
      current = [];
      currentBytes = 0;
    }
    current.push(item);
    currentBytes += size;
  }

  if (current.length > 0) chunks.push(current);
  return chunks;
}
