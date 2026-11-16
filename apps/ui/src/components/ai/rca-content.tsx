import { CredentialSourceChip } from '~/components/ai/credential-source-chip';
import { CONFIDENCE_STYLES, NOT_ESTABLISHED, firstSentence, splitVerify } from '~/lib/rca-view';
import type { RcaAnalysis } from '~/lib/rca.types';

export type { RcaAnalysis, RcaSeverity } from '~/lib/rca.types';

function Section({ title, count, children }: { title: string; count?: number; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
        {count ? <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium normal-case tracking-normal">{count}</span> : null}
      </h3>
      {children}
    </section>
  );
}

function Fold({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <details className="group rounded-lg border border-border">
      <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-2.5 text-sm font-medium">
        <span>{title} <span className="ml-1 text-xs font-normal text-muted-foreground">{items.length}</span></span>
        <span className="text-xs text-muted-foreground group-open:hidden">Show</span>
        <span className="hidden text-xs text-muted-foreground group-open:inline">Hide</span>
      </summary>
      <ul className="space-y-2 border-t border-border px-4 py-3 text-sm leading-6 text-muted-foreground">
        {items.map((item, index) => <li key={`${title}-${index}`} className="border-l-2 border-[#8BD125] pl-3">{item}</li>)}
      </ul>
    </details>
  );
}

function NextSteps({ steps }: { steps: string[] }) {
  if (!steps.length) return null;
  return (
    <Section title="Next steps" count={steps.length}>
      <ol className="space-y-2">
        {steps.map((step, index) => {
          const { action, verify } = splitVerify(step);
          return (
            <li key={index} className="flex gap-3 rounded-lg border border-border p-3">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#8BD125] text-[11px] font-semibold text-[#182012]">{index + 1}</span>
              <div className="space-y-1 text-sm leading-6">
                <p>{action}</p>
                {verify ? <p className="text-xs text-muted-foreground"><span className="font-medium">Verify first:</span> {verify}</p> : null}
              </div>
            </li>
          );
        })}
      </ol>
    </Section>
  );
}

export function RcaContent({ rca, history }: { rca: RcaAnalysis; history: RcaAnalysis[] }) {
  const unknown = NOT_ESTABLISHED.test(rca.rootCause);
  return (
    <div className="mt-5 space-y-5">
      <div className="space-y-2 rounded-lg border border-border bg-secondary p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${CONFIDENCE_STYLES[rca.confidence]}`}>{rca.confidence} confidence</span>
          {unknown ? <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">Cause not established</span> : null}
        </div>
        <p className="text-sm font-medium leading-6 text-[#182012]">{firstSentence(rca.summary)}</p>
        {rca.summary.length > firstSentence(rca.summary).length ? <p className="text-sm leading-6 text-[#182012]/80">{rca.summary.slice(firstSentence(rca.summary).length).trim()}</p> : null}
      </div>
      <Section title="Root cause">
        <p className={`rounded-lg border p-3 text-sm leading-6 ${unknown ? 'border-[#F59E0B]/40 bg-[#FFFBEB] text-[#713F12]' : 'border-border'}`}>{rca.rootCause}</p>
      </Section>
      <NextSteps steps={rca.suggestedChanges} />
      <div className="space-y-2">
        <Fold title="Contributing factors" items={rca.contributingFactors} />
        <Fold title="Investigation path" items={rca.investigationSteps} />
        <Fold title="Limitations" items={rca.limitations} />
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span>{rca.model}</span>
        <span>Prompt {rca.promptVersion}</span>
        <CredentialSourceChip source={rca.credentialSource} />
        <span>{new Date(rca.createdAt).toLocaleString()}</span>
        {history.length > 1 ? <span>History: {history.length}</span> : null}
      </div>
    </div>
  );
}
