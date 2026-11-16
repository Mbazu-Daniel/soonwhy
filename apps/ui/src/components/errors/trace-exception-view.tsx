import { StackTraceView } from '~/components/errors/stack-trace-view';
import type { TraceException } from '~/lib/error-groups';

export function TraceExceptionView({ exception }: { exception: TraceException }) {
  const heading = [exception.type, exception.message].filter(Boolean).join(': ');
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        The HTTP error carries no stack, but a span in its trace recorded this exception
        {exception.spanName ? <> in <span className="font-mono">{exception.spanName}</span></> : null}.
      </p>
      <p className="break-words rounded-md border border-border bg-muted px-3 py-2 font-mono text-xs">{heading}</p>
      {exception.stacktrace ? <StackTraceView stack={exception.stacktrace} /> : null}
    </div>
  );
}
