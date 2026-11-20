const numericParts = (version: string) =>
  version
    .replace(/^v/i, "")
    .split(/[-+]/)[0]!
    .split(".")
    .map((part) => Number.parseInt(part, 10) || 0);

export function compareVersions(a: string, b: string): number {
  const left = numericParts(a);
  const right = numericParts(b);
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    const diff = (left[index] ?? 0) - (right[index] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

export function lowestUpgrade(current: string, fixed: string[]): string | null {
  const newer = fixed.filter((version) => compareVersions(version, current) > 0).sort(compareVersions);
  return newer[0] ?? null;
}
