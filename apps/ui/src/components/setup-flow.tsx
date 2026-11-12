import {
  createContext,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { ArrowLeft, ArrowRight, Check, Copy, Loader2, RefreshCw, Terminal } from 'lucide-react';
import { Button } from '~/components/ui/button';
import { cn } from '~/lib/utils';

interface SetupFlowStep {
  id: string;
  title: string;
}

const SetupFlowContext = createContext<{ activeId: string; id: string } | null>(null);

export function SetupFlow({
  steps,
  children,
  onRecheck,
  isRechecking = false,
  buttonSize = 'sm',
}: {
  steps: readonly SetupFlowStep[];
  children: ReactNode;
  onRecheck?: () => void;
  isRechecking?: boolean;
  buttonSize?: 'sm' | 'default';
}) {
  const id = useId();
  const [selectedId, setSelectedId] = useState(steps[0]?.id ?? '');
  const selectedIndex = Math.max(0, steps.findIndex((step) => step.id === selectedId));
  const activeId = steps[selectedIndex]?.id ?? '';
  const isFinalStep = selectedIndex === steps.length - 1;
  const tabs = useRef<Array<HTMLButtonElement | null>>([]);

  function changeStep(nextId: string) {
    const nextIndex = steps.findIndex((step) => step.id === nextId);
    if (nextIndex < 0 || nextIndex === selectedIndex) return;
    setSelectedId(nextId);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const last = steps.length - 1;
    const next =
      event.key === 'ArrowRight' ? (selectedIndex + 1) % steps.length
      : event.key === 'ArrowLeft' ? (selectedIndex + last) % steps.length
      : event.key === 'Home' ? 0
      : event.key === 'End' ? last
      : -1;
    if (next < 0 || !steps[next]) return;
    event.preventDefault();
    setSelectedId(steps[next].id);
    tabs.current[next]?.focus();
  }

  return (
    <SetupFlowContext.Provider value={{ activeId, id }}>
      <section
        className="min-w-0 overflow-hidden rounded-xl border border-[#242426] bg-[#080808]"
        aria-label="Setup guide"
      >
        <div
          role="tablist"
          aria-label="Setup steps"
          aria-orientation="horizontal"
          className="flex min-w-0 gap-1 overflow-x-auto border-b border-[#242426] p-2 [scrollbar-width:thin]"
        >
          {steps.map((step, index) => {
            const selected = index === selectedIndex;
            return (
              <button
                key={step.id}
                ref={(element) => { tabs.current[index] = element; }}
                id={`${id}-tab-${step.id}`}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls={`${id}-panel-${step.id}`}
                tabIndex={selected ? 0 : -1}
                onClick={() => changeStep(step.id)}
                onKeyDown={handleKeyDown}
                className={cn(
                  'relative inline-flex min-h-10 flex-1 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-lg px-3 text-xs transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#ACFC15] motion-reduce:transition-none',
                  selected ? 'bg-[#151517] text-[#F6F6F6]' : 'text-[#989898] hover:bg-[#101011] hover:text-[#F6F6F6]',
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    'inline-flex size-5 shrink-0 items-center justify-center rounded-md font-mono text-[10px]',
                    selected ? 'bg-[#242426] text-[#ACFC15]' : 'text-[#6E6E70]',
                  )}
                >
                  {index + 1}
                </span>
                <span>{step.title}</span>
              </button>
            );
          })}
        </div>
        {children}
        {steps.length > 1 && (
          <div className="flex flex-wrap items-center justify-center gap-3 border-t border-[#242426] px-5 py-3 sm:px-6">
            <Button
              type="button"
              size={buttonSize}
              variant="ghost"
              disabled={selectedIndex === 0}
              onClick={() => changeStep(steps[selectedIndex - 1].id)}
            >
              <ArrowLeft /> Back
            </Button>
            <span aria-live="polite" className="min-w-14 text-center text-[11px] tabular-nums text-[#989898]">
              {selectedIndex + 1} of {steps.length}
            </span>
            {isFinalStep && onRecheck ? (
              <Button type="button" size={buttonSize} variant="secondary" disabled={isRechecking} onClick={onRecheck}>
                {isRechecking ? <Loader2 className="animate-spin" /> : <RefreshCw />} Check connection
              </Button>
            ) : (
              <Button
                type="button"
                size={buttonSize}
                variant="secondary"
                disabled={isFinalStep}
                onClick={() => changeStep(steps[selectedIndex + 1].id)}
              >
                Next step <ArrowRight />
              </Button>
            )}
          </div>
        )}
      </section>
    </SetupFlowContext.Provider>
  );
}

export function SetupStep({
  number,
  title,
  children,
}: {
  number: string;
  title: string;
  children: ReactNode;
}) {
  const flow = useContext(SetupFlowContext);
  return (
    <div
      role={flow ? 'tabpanel' : undefined}
      id={flow ? `${flow.id}-panel-${number}` : undefined}
      aria-labelledby={flow ? `${flow.id}-tab-${number}` : undefined}
      tabIndex={flow ? 0 : undefined}
      hidden={flow ? flow.activeId !== number : undefined}
      className="min-h-[220px] min-w-0 p-5 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#ACFC15] sm:p-6"
      data-setup-step={number}
    >
      <h2 className="mb-3 text-sm font-semibold text-[#F6F6F6]">{title}</h2>
      {children}
    </div>
  );
}

export function SetupCodeBlock({
  children,
  multiline = false,
  fileName,
}: {
  children: string;
  multiline?: boolean;
  fileName?: string;
}) {
  return (
    <div className="min-w-0 overflow-hidden rounded-lg border border-[#242426] bg-[#0B0B0C]">
      {fileName && (
        <div className="flex items-center justify-between gap-3 border-b border-[#242426] py-2 pl-3.5 pr-2">
          <span className="font-mono text-[11px] text-[#989898]">{fileName}</span>
          <SetupCopyButton value={children} label={`Copy ${fileName}`} />
        </div>
      )}
      <div className="flex min-w-0 items-start gap-2.5 p-3.5">
        {!multiline && <Terminal aria-hidden="true" className="mt-1.5 h-3.5 w-3.5 shrink-0 text-[#6E6E70]" />}
        <pre
          tabIndex={0}
          aria-label={fileName ? `Code for ${fileName}` : multiline ? 'Code example' : 'Terminal command'}
          className="min-w-0 flex-1 overflow-x-auto py-1 font-mono text-[12px] leading-5 text-[#D8D8D8] [scrollbar-width:thin] focus-visible:outline-2 focus-visible:outline-[#ACFC15]"
        >
          <code>{children}</code>
        </pre>
        {!fileName && <SetupCopyButton value={children} label={multiline ? 'Copy code' : 'Copy command'} />}
      </div>
    </div>
  );
}

export function SetupCopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void copy()}
      aria-label={label}
      title={label}
      className="grid h-7 w-7 shrink-0 cursor-pointer place-items-center rounded-md text-[#989898] transition-colors hover:bg-[#151517] hover:text-[#F6F6F6] focus-visible:outline-2 focus-visible:outline-[#ACFC15]"
    >
      {copied ? <Check aria-hidden="true" className="h-3.5 w-3.5 text-[#ACFC15]" /> : <Copy aria-hidden="true" className="h-3.5 w-3.5" />}
    </button>
  );
}
