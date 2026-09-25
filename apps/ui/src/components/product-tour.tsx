import { useState } from 'react';
import { ArrowRight, Check, X } from 'lucide-react';
import { Button } from '~/components/ui/button';

const TOUR_KEY = 'soonwhy:dashboard-tour-complete';

const steps = [
  { title: 'Start with the project context', text: 'The project selector in the top bar scopes every dashboard view to one telemetry project.' },
  { title: 'Follow the evidence', text: 'Use Detections, Traces and Investigations to move from a signal to the evidence behind it.' },
  { title: 'Make the dashboard yours', text: 'Use Cmd+K or Ctrl+K to move quickly between views and save frequently used views.' },
];

export function ProductTour() {
  const [index, setIndex] = useState(0);
  const [open, setOpen] = useState(() => typeof window !== 'undefined' && localStorage.getItem(TOUR_KEY) !== '1');

  if (!open) return null;
  const current = steps[index];
  const last = index === steps.length - 1;

  function close() {
    localStorage.setItem(TOUR_KEY, '1');
    setOpen(false);
  }

  return (
    <div className="fixed inset-x-4 bottom-4 z-50 sm:left-auto sm:right-6 sm:max-w-sm" role="dialog" aria-label="SoonWhy product tour" aria-modal="false">
      <div className="rounded-2xl border border-[#C9D8C5] bg-white p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div><p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#16931F]">Quick tour · {index + 1}/{steps.length}</p><h2 className="mt-2 text-base font-semibold">{current.title}</h2></div>
          <button type="button" onClick={close} className="rounded-md p-1 text-muted-foreground hover:bg-muted" aria-label="Close product tour"><X className="h-4 w-4" /></button>
        </div>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{current.text}</p>
        <div className="mt-5 flex items-center justify-between">
          <button type="button" onClick={close} className="text-xs font-medium text-muted-foreground hover:text-foreground">Skip tour</button>
          <Button size="sm" onClick={() => last ? close() : setIndex((value) => value + 1)} className="bg-[#182012] text-white hover:bg-[#182012]/90">
            {last ? <>Done <Check /></> : <>Next <ArrowRight /></>}
          </Button>
        </div>
      </div>
    </div>
  );
}
