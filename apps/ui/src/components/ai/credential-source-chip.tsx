const LABEL = { byok: "Your key", platform: "Platform key" } as const;

/** Rows written before the hybrid provider layer carry no attribution and render nothing. */
export function CredentialSourceChip({
  source,
}: {
  source: keyof typeof LABEL | null;
}) {
  if (!source) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-[#C9D8C5] bg-[#F1F7EC] px-2 py-0.5 text-[11px] text-[#182012]">
      {LABEL[source]}
    </span>
  );
}
