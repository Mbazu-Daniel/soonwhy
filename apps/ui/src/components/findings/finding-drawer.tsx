import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { Badge } from '~/components/ui/badge';
import { FindingStatusActions } from '~/components/findings/finding-status-actions';
import { SuspectDeploymentRow } from '~/components/findings/suspect-deployment';
import { RemediationPanel } from '~/components/findings/remediation-panel';
import { FINDING_CATEGORY_LABELS } from '~/lib/findings.constants';
import { evidenceObject, formatValue, ruleLabel, statusLabel } from '~/lib/findings';
import { FindingEvidence } from './finding-evidence';
import type { DetectionFinding } from '~/lib/findings.types';

const SEVERITY_STYLE = {
  critical: 'border-[#F8C7C2] bg-[#FDE8E6] text-[#8A1C13]',
  warning: 'border-[#FDE68A] bg-[#FEF3C7] text-[#713F12]',
} as const;

export function FindingDrawer({
  finding,
  projectId,
  organizationSlug,
  onClose,
}: {
  finding: DetectionFinding | null;
  projectId: string;
  organizationSlug: string;
  onClose: () => void;
}) {
  return (
    <DialogPrimitive.Root open={finding !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <DialogPrimitive.Content className="fixed inset-y-0 right-0 z-50 w-full max-w-xl overflow-y-auto border-l border-border bg-background p-6 shadow-xl outline-none">
          {finding && (
            <div className="space-y-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className={SEVERITY_STYLE[finding.severity]}>
                    {finding.severity}
                  </Badge>
                  <Badge variant="outline">{statusLabel(finding.status)}</Badge>
                  <Badge variant="outline">{FINDING_CATEGORY_LABELS[finding.category]}</Badge>
                </div>
                <DialogPrimitive.Close aria-label="Close" className="rounded-md p-1 text-[#8A1C13] hover:bg-muted">
                  <X className="h-5 w-5" />
                </DialogPrimitive.Close>
              </div>

              <SuspectDeploymentRow projectId={projectId} finding={finding} />
              <div>
                <p className="font-mono text-[11px] tracking-wide text-muted-foreground">{ruleLabel(finding.type)}</p>
                <DialogPrimitive.Title className="mt-1 text-xl font-semibold leading-snug">{finding.title}</DialogPrimitive.Title>
                <DialogPrimitive.Description className="mt-2 text-sm leading-6 text-muted-foreground">
                  {finding.description}
                </DialogPrimitive.Description>
              </div>

              <FindingStatusActions projectId={projectId} finding={finding} />

              {finding.recommendation && (
                <section className="rounded-xl border border-border bg-card p-4 text-sm">
                  <h2 className="mb-1 font-semibold">Recommended fix</h2>
                  <p className="leading-6 text-muted-foreground">{finding.recommendation}</p>
                </section>
              )}

              <dl className="space-y-2 rounded-xl bg-muted p-4 text-sm">
                <Row label="Affected service" value={finding.serviceName} />
                <Row label="First detected" value={new Date(finding.windowStart).toLocaleString()} />
                <Row label="Last seen" value={new Date(finding.lastSeenAt).toLocaleString()} />
                <Row label="Times detected" value={String(finding.occurrences)} />
                {finding.resolvedAt && <Row label="Resolved" value={new Date(finding.resolvedAt).toLocaleString()} />}
                {finding.category !== 'vulnerability' && (
                  <Row label="Observed" value={`${formatValue(finding.observedValue, finding.unit)} (threshold ${formatValue(finding.threshold, finding.unit)})`} />
                )}
              </dl>

              <div>
                <h2 className="mb-2 text-sm font-semibold">Evidence</h2>
                <FindingEvidence evidence={evidenceObject(finding)} />
              </div>

              <RemediationPanel projectId={projectId} finding={finding} organizationSlug={organizationSlug} />
            </div>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-semibold">{value}</dd>
    </div>
  );
}
