import { Check, ChevronDown, ChevronRight, Copy } from 'lucide-react';
import { useState } from 'react';
import { Button } from '~/components/ui/button';
import { parseStackTrace } from '~/lib/stack-trace';
import type { StackFrame, StackSection } from '~/lib/stack-trace.types';

function FrameRow({ frame }: { frame: StackFrame }) {
  const app = frame.origin === 'app';
  return (
    <li className={`flex flex-wrap items-baseline gap-x-2 px-3 py-1.5 font-mono text-xs leading-5 ${app ? 'bg-[#FDE8E6]/40' : 'text-muted-foreground'}`}>
      <span className={app ? 'font-semibold text-foreground' : ''}>{frame.fn}</span>
      <span className="break-all">
        {frame.file}
        {frame.line !== null && `:${frame.line}`}
        {frame.column !== null && `:${frame.column}`}
      </span>
    </li>
  );
}

function Section({ section, showAll }: { section: StackSection; showAll: boolean }) {
  const visible = showAll ? section.frames : section.frames.filter((frame) => frame.origin === 'app');
  const hidden = section.frames.length - visible.length;
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      {section.header && (
        <p className="whitespace-pre-wrap break-words bg-muted px-3 py-2 font-mono text-xs font-medium">
          {section.isCause && <span className="mr-2 text-muted-foreground">Caused by</span>}
          {section.header}
        </p>
      )}
      {visible.length > 0 && <ul className="divide-y divide-border">{visible.map((frame, index) => <FrameRow key={`${frame.raw}-${index}`} frame={frame} />)}</ul>}
      {!showAll && hidden > 0 && <p className="border-t border-border px-3 py-1.5 text-xs text-muted-foreground">{hidden} library and internal {hidden === 1 ? 'frame' : 'frames'} hidden</p>}
    </div>
  );
}

export function StackTraceView({ stack }: { stack: string }) {
  const [showAll, setShowAll] = useState(false);
  const [copied, setCopied] = useState(false);
  const sections = parseStackTrace(stack);
  const hasFrames = sections.some((section) => section.frames.length > 0);
  const hasApp = sections.some((section) => section.frames.some((frame) => frame.origin === 'app'));
  const expanded = showAll || !hasApp;

  const copy = () => {
    void navigator.clipboard.writeText(stack).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    });
  };

  if (!hasFrames) return <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-lg bg-muted p-3 font-mono text-xs leading-5">{stack}</pre>;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        {hasApp ? (
          <Button type="button" size="sm" variant="ghost" onClick={() => setShowAll((value) => !value)}>
            {showAll ? <ChevronDown className="mr-1 h-3.5 w-3.5" /> : <ChevronRight className="mr-1 h-3.5 w-3.5" />}
            {showAll ? 'Hide library frames' : 'Show all frames'}
          </Button>
        ) : <span />}
        <Button type="button" size="sm" variant="ghost" onClick={copy}>
          {copied ? <Check className="mr-1 h-3.5 w-3.5" /> : <Copy className="mr-1 h-3.5 w-3.5" />}
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>
      <div className="max-h-96 space-y-2 overflow-auto">
        {sections.map((section, index) => <Section key={`${section.header}-${index}`} section={section} showAll={expanded} />)}
      </div>
    </div>
  );
}
