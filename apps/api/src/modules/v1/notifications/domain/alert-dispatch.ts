export function dispatchedAtOf(metadata: unknown): Date | undefined {
  const value = (metadata as { dispatchedAt?: unknown } | null | undefined)?.dispatchedAt;
  if (typeof value !== "string") return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}
