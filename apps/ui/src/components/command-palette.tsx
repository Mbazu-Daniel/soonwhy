import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from '@tanstack/react-router';
import { Command, Search, Star, LayoutDashboard, Server, BrainCircuit, ShieldCheck, AlertTriangle, ScrollText, GitBranch } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '~/components/ui/dialog';
import { Input } from '~/components/ui/input';
import { Button } from '~/components/ui/button';

interface SavedView { id: string; name: string; path: string; }

const NAV_ITEMS = [
  { path: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { path: '/dashboard/services', label: 'Services', icon: Server },
  { path: '/dashboard/detections', label: 'Detections', icon: BrainCircuit },
  { path: '/dashboard/investigations', label: 'Investigations', icon: ShieldCheck },
  { path: '/dashboard/errors', label: 'Errors', icon: AlertTriangle },
  { path: '/dashboard/logs', label: 'Logs', icon: ScrollText },
  { path: '/dashboard/traces', label: 'Traces', icon: GitBranch },
] as const;

const STORAGE_KEY = 'soonwhy:saved-views';

function readSavedViews(): SavedView[] {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value ? (JSON.parse(value) as SavedView[]) : [];
  } catch {
    return [];
  }
}

export function CommandPalette() {
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [savedViews, setSavedViews] = useState<SavedView[]>([]);

  useEffect(() => {
    setSavedViews(readSavedViews());
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen((current) => !current);
      }
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    if (!open) return;
    setQuery('');
  }, [open]);

  const items = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const navigation = NAV_ITEMS.filter((item) => !normalized || item.label.toLowerCase().includes(normalized));
    const saved = savedViews.filter((view) => !normalized || view.name.toLowerCase().includes(normalized));
    return { navigation, saved };
  }, [query, savedViews]);

  function go(path: string) {
    setOpen(false);
    void navigate({ to: path });
  }

  function saveCurrentView() {
    const name = window.prompt('Name this view');
    if (!name?.trim()) return;
    const next = [...savedViews.filter((view) => view.path !== location.pathname), { id: crypto.randomUUID(), name: name.trim(), path: location.pathname }];
    setSavedViews(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  function removeView(id: string) {
    const next = savedViews.filter((view) => view.id !== id);
    setSavedViews(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)} className="hidden h-9 gap-2 bg-[#F7FAF4] border-[#DBE5D7] text-muted-foreground font-normal md:flex" aria-label="Open command palette">
        <Search className="h-4 w-4" />
        <span>Search telemetry</span>
        <kbd className="ml-3 rounded border bg-white px-1.5 py-0.5 text-[10px]">⌘K</kbd>
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl gap-0 overflow-hidden p-0">
          <DialogTitle className="sr-only">SoonWhy command palette</DialogTitle>
          <DialogDescription className="sr-only">Navigate between observability surfaces and saved views.</DialogDescription>
          <div className="border-b p-3">
            <div className="relative">
              <Command className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#16931F]" />
              <Input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Jump to a workspace or saved view…" className="h-11 border-0 bg-[#F7FAF4] pl-9 shadow-none focus-visible:ring-0" />
            </div>
          </div>
          <div className="max-h-[55vh] overflow-auto p-2">
            {items.navigation.length > 0 && <section>
              <p className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[.14em] text-muted-foreground">Navigate</p>
              {items.navigation.map(({ path, label, icon: Icon }) => <button key={path} type="button" onClick={() => go(path)} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm hover:bg-[#F7FAF4] focus-visible:bg-[#F7FAF4]"><Icon className="h-4 w-4 text-[#16931F]" /><span>{label}</span></button>)}
            </section>}
            <section className="mt-2">
              <div className="flex items-center justify-between px-3 py-2"><p className="text-[10px] font-semibold uppercase tracking-[.14em] text-muted-foreground">Saved views</p><button type="button" onClick={saveCurrentView} className="text-xs font-medium text-[#16931F] hover:underline">Save current</button></div>
              {items.saved.length === 0 ? <p className="px-3 pb-3 text-xs text-muted-foreground">Save frequently used investigation surfaces here.</p> : items.saved.map((view) => <div key={view.id} className="group flex items-center gap-2 rounded-lg px-3 py-2.5 hover:bg-[#F7FAF4]"><button type="button" onClick={() => go(view.path)} className="flex min-w-0 flex-1 items-center gap-3 text-left text-sm"><Star className="h-4 w-4 shrink-0 text-[#16931F]" /><span className="truncate">{view.name}</span></button><button type="button" onClick={() => removeView(view.id)} className="hidden text-xs text-muted-foreground hover:text-[#8A1C13] group-hover:block">Remove</button></div>)}
            </section>
          </div>
          <div className="border-t bg-[#F7FAF4] px-4 py-2 text-[11px] text-muted-foreground">Press <kbd className="rounded border bg-white px-1">Esc</kbd> to close</div>
        </DialogContent>
      </Dialog>
    </>
  );
}
