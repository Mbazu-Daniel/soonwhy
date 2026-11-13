import { useEffect, useState, type FormEvent } from 'react';
import { AlertTriangle, Check, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '~/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '~/components/ui/dialog';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';

interface ConfirmDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmationText: string;
  confirmLabel: string;
  pending?: boolean;
  error?: string | null;
  onConfirm: () => void;
}

export function ConfirmDeleteDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmationText,
  confirmLabel,
  pending = false,
  error = null,
  onConfirm,
}: ConfirmDeleteDialogProps) {
  const [input, setInput] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (open) {
      setInput('');
      setCopied(false);
    }
  }, [open]);

  const matches = input.trim() === confirmationText;

  async function copySlug() {
    try {
      await navigator.clipboard?.writeText(confirmationText);
      setCopied(true);
      toast.success('Slug copied');
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error('Could not copy to clipboard');
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!matches || pending) return;
    onConfirm();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-[#2B1A1A] bg-[#140C0C] text-[#F6F6F6]">
        <DialogHeader>
          <div className="mb-1 flex h-11 w-11 items-center justify-center rounded-xl bg-red-950/50 text-red-400">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="text-[#989898]">{description}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="delete-confirmation" className="text-[#C9C9CB]">Type the slug to confirm</Label>
            <div className="flex items-center justify-between gap-2 rounded-lg border border-[#2B1A1A] bg-[#0B0B0C] py-1.5 pl-3 pr-1.5">
              <code className="select-all font-mono text-sm text-red-300">{confirmationText}</code>
              <Button type="button" variant="ghost" size="sm" className="h-8 gap-1.5 text-[#989898] hover:bg-[#1A1A1C] hover:text-[#F6F6F6]" onClick={() => void copySlug()} aria-label="Copy slug">
                {copied ? <Check className="h-4 w-4 text-[#ACFC15]" /> : <Copy className="h-4 w-4" />}
                Copy
              </Button>
            </div>
            <Input
              id="delete-confirmation"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              autoComplete="off"
              autoFocus
              placeholder={confirmationText}
              className="border-[#2B1A1A] bg-[#0B0B0C] text-[#F6F6F6] placeholder:text-[#5A5A5C]"
            />
          </div>
          {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" className="border-[#242426] bg-[#151517] text-[#F6F6F6] hover:bg-[#1A1A1C]" onClick={() => onOpenChange(false)} disabled={pending}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!matches || pending}
              className="bg-red-600 text-white hover:bg-red-500 disabled:opacity-40"
            >
              {pending ? 'Deleting...' : confirmLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
