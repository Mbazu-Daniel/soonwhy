export function desiredCommitTimeout(config: Record<string, unknown>): number | undefined {
  const settings = config.indexing_settings as { commit_timeout_secs?: unknown } | undefined;
  const value = settings?.commit_timeout_secs;
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : undefined;
}

export function withCommitTimeout(
  indexConfig: Record<string, unknown>,
  seconds: number,
): Record<string, unknown> | undefined {
  const current = (indexConfig.indexing_settings ?? {}) as Record<string, unknown>;
  if (current.commit_timeout_secs === seconds) return undefined;
  const { doc_mapping_uid: _ignored, ...docMapping } = (indexConfig.doc_mapping ?? {}) as Record<string, unknown>;
  return {
    ...indexConfig,
    ...(indexConfig.doc_mapping ? { doc_mapping: docMapping } : {}),
    indexing_settings: { ...current, commit_timeout_secs: seconds },
  };
}
