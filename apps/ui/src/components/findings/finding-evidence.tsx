const sentenceCase = (label: string) => label.charAt(0).toUpperCase() + label.slice(1);

const displayValue = (value: unknown): string =>
  typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' ? String(value) : JSON.stringify(value);

export function FindingEvidence({ evidence }: { evidence: Record<string, unknown> }) {
  return (
    <dl className="divide-y divide-border rounded-xl border border-border text-sm">
      {Object.entries(evidence).map(([label, value]) => (
        <div key={label} className="flex justify-between gap-4 px-4 py-2">
          <dt className="shrink-0 text-muted-foreground">{sentenceCase(label)}</dt>
          <dd className="min-w-0 break-all text-right font-mono text-xs leading-5">{displayValue(value)}</dd>
        </div>
      ))}
    </dl>
  );
}
