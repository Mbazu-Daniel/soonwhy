import { useState } from 'react';
import { Bookmark, Link2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '~/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '~/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '~/components/ui/dropdown-menu';
import { Input } from '~/components/ui/input';
import { sanitizeView, shareUrl, type LogViewState } from '~/lib/log-view';
import { useDeleteView, useSaveView, useSavedViews } from '~/lib/use-saved-views';

interface Props {
  projectId: string | null | undefined;
  view: LogViewState;
  onApply: (view: LogViewState) => void;
}

async function copy(text: string, done: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(done);
  } catch {
    toast.error('Could not copy. Copy the address from the browser bar instead.');
  }
}

export function LogViewsMenu({ projectId, view, onApply }: Props) {
  const views = useSavedViews(projectId);
  const save = useSaveView(projectId);
  const remove = useDeleteView(projectId);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');

  function submit() {
    const trimmed = name.trim();
    if (!trimmed) return;
    save.mutate({ name: trimmed, view }, {
      onSuccess: (saved) => {
        setOpen(false);
        setName('');
        void copy(`${window.location.origin}${window.location.pathname}?view=${encodeURIComponent(saved.id)}`, 'Saved. Short link copied.');
      },
    });
  }

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" className="h-8 gap-1 px-2 text-xs" onClick={() => void copy(shareUrl(view, window.location.origin, window.location.pathname), 'Link to this search copied')}>
        <Link2 className="h-3.5 w-3.5" />Share
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-8 gap-1 px-2 text-xs"><Bookmark className="h-3.5 w-3.5" />Views</Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72">
          <DropdownMenuItem onSelect={() => setOpen(true)}>Save this search…</DropdownMenuItem>
          <DropdownMenuSeparator />
          {views.isLoading && <p className="px-2 py-1.5 text-xs text-muted-foreground">Loading…</p>}
          {views.isError && <p className="px-2 py-1.5 text-xs text-muted-foreground">Saved views are unavailable right now.</p>}
          {views.data?.length === 0 && <p className="px-2 py-1.5 text-xs text-muted-foreground">No saved views yet.</p>}
          {views.data?.map((saved) => (
            <DropdownMenuItem key={saved.id} className="justify-between gap-2" onSelect={() => onApply(sanitizeView(saved.query))}>
              <span className="truncate">{saved.name}</span>
              <span className="flex shrink-0 items-center gap-1">
                <button type="button" aria-label={`Copy link to ${saved.name}`} className="rounded p-1 hover:bg-muted" onClick={(event) => { event.stopPropagation(); void copy(`${window.location.origin}${window.location.pathname}?view=${encodeURIComponent(saved.id)}`, 'Short link copied'); }}><Link2 className="h-3 w-3" /></button>
                <button type="button" aria-label={`Delete ${saved.name}`} className="rounded p-1 text-[#F28B82] hover:bg-muted" onClick={(event) => { event.stopPropagation(); remove.mutate(saved.id); }}><Trash2 className="h-3 w-3" /></button>
              </span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save this search</DialogTitle>
            <DialogDescription>Everyone in the project can open it. It keeps the query, level, time range and filters.</DialogDescription>
          </DialogHeader>
          <Input aria-label="View name" autoFocus placeholder="Name, for example Checkout errors" value={name} maxLength={120} onChange={(event) => setName(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') submit(); }} />
          {save.isError && <p className="text-sm text-[#F28B82]">{save.error instanceof Error ? save.error.message : 'Could not save.'}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button disabled={save.isPending || !name.trim()} onClick={submit}>{save.isPending ? 'Saving…' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
