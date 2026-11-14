import { Link } from '@tanstack/react-router';
import type { TraceSpan } from '~/components/trace/trace.types';

export function SpanException({ span }: { span: TraceSpan }) {
  if (!span.exceptionType && !span.exceptionMessage && !span.exceptionStacktrace) return null;
  return (
    <div className="space-y-2 rounded-lg border border-[#F8C7C2] bg-[#FDE8E6]/40 p-3">
      <p className="text-xs font-medium text-[#8A1C13]">Exception</p>
      <p className="break-words font-mono text-xs">{[span.exceptionType, span.exceptionMessage].filter(Boolean).join(': ')}</p>
      {span.exceptionStacktrace && <pre className="max-h-48 overflow-auto rounded bg-muted p-2 text-[10px] leading-4">{span.exceptionStacktrace}</pre>}
    </div>
  );
}

export function SpanEvents({ span }: { span: TraceSpan }) {
  if (!span.events?.length) return null;
  return (
    <div>
      <p className="text-xs text-muted-foreground">Events ({span.events.length})</p>
      <ul className="mt-2 max-h-48 space-y-2 overflow-auto">
        {span.events.map((event, index) => (
          <li key={index} className="rounded-lg bg-muted p-2 text-[10px]">
            <p className="font-medium">{event.name}{event.timestamp ? <span className="ml-2 font-normal text-muted-foreground">{new Date(event.timestamp).toLocaleTimeString()}</span> : null}</p>
            {Object.keys(event.attributes ?? {}).length > 0 && <pre className="mt-1 overflow-auto">{JSON.stringify(event.attributes, null, 2)}</pre>}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SpanLinks({ span, organizationSlug, projectSlug }: { span: TraceSpan; organizationSlug: string; projectSlug: string }) {
  if (!span.links?.length) return null;
  return (
    <div>
      <p className="text-xs text-muted-foreground">Links ({span.links.length})</p>
      <ul className="mt-2 space-y-1">
        {span.links.map((link) => (
          <li key={`${link.traceId}-${link.spanId}`}>
            <Link to="/$organizationSlug/p/$projectSlug/trace/$traceId" params={{ organizationSlug, projectSlug, traceId: link.traceId }} className="font-mono text-[10px] text-[#16931F] hover:underline">
              {link.traceId.slice(0, 12)} / {link.spanId.slice(0, 8)}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
