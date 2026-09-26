export function snapshotTimestamp(date = new Date()): string {
  const iso = date.toISOString();

  return iso
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z');
}
