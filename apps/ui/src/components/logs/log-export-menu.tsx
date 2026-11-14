import { useState } from 'react';
import { Download } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '~/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '~/components/ui/dropdown-menu';
import { api } from '~/lib/api';
import { exportParams, type LogSearchParams } from '~/lib/use-log-search';

type Format = 'ndjson' | 'csv';

export function LogExportMenu({ search, total }: { search: LogSearchParams; total: number }) {
  const [busy, setBusy] = useState(false);

  async function run(format: Format) {
    setBusy(true);
    try {
      const { blob, filename } = await api.blob(`/projects/${search.projectId}/logs/export?${exportParams(search, format)}`);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename ?? `logs.${format}`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Export failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1 px-2 text-xs" disabled={busy || total === 0}><Download className="h-3.5 w-3.5" />{busy ? 'Exporting…' : 'Export'}</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => void run('ndjson')}>NDJSON, up to 1,000 rows</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void run('csv')}>CSV, up to 1,000 rows</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
