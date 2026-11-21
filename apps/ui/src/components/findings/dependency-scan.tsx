import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '~/components/ui/button';
import { Card, CardContent } from '~/components/ui/card';
import { Input } from '~/components/ui/input';
import { api, apiProblem } from '~/lib/api';
import { packagesFromLockfile } from '~/lib/lockfile';
import type { DependencySnapshotRow, DependencyScanSummary } from '~/lib/findings.types';

export function DependencyScan({ projectId }: { projectId: string }) {
  const queryClient = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const [serviceName, setServiceName] = useState('');
  const snapshots = useQuery({
    queryKey: ['dependencies', projectId],
    queryFn: () => api.get<DependencySnapshotRow[]>(`/projects/${projectId}/dependencies`),
  });
  const scan = useMutation({
    mutationFn: async (file: File) => {
      const packages = packagesFromLockfile(await file.text());
      if (packages.length === 0) throw new Error('No packages found. Upload a package-lock.json.');
      return api.post<DependencyScanSummary>(`/projects/${projectId}/dependencies`, { serviceName: serviceName.trim(), ecosystem: 'npm', packages });
    },
    onSuccess: (summary) => {
      toast.success(`Scanned ${summary.packages} packages: ${summary.vulnerabilities} vulnerable, ${summary.resolved} resolved`);
      void queryClient.invalidateQueries({ queryKey: ['dependencies', projectId] });
      void queryClient.invalidateQueries({ queryKey: ['detections', projectId] });
      void queryClient.invalidateQueries({ queryKey: ['finding-report', projectId] });
    },
    onError: (error) => toast.error(apiProblem(error).detail ?? (error instanceof Error ? error.message : 'Scan failed')),
  });

  return (
    <Card className="shadow-none">
      <CardContent className="space-y-3 p-4">
        <p className="text-sm font-semibold">Scan dependencies for known vulnerabilities</p>
        <div className="flex flex-wrap items-center gap-2">
          <Input value={serviceName} onChange={(event) => setServiceName(event.target.value)} placeholder="Service name" aria-label="Service name" className="max-w-xs" />
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) scan.mutate(file);
              event.target.value = '';
            }}
          />
          <Button size="sm" variant="outline" disabled={!serviceName.trim() || scan.isPending} onClick={() => fileInput.current?.click()}>
            {scan.isPending ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Upload className="mr-2 h-3.5 w-3.5" />}
            Upload package-lock.json
          </Button>
        </div>
        {!!snapshots.data?.length && (
          <ul className="space-y-1 text-xs text-muted-foreground">
            {snapshots.data.map((row) => (
              <li key={row.id}>
                {row.serviceName}: {row.lastScanError ? `last scan failed (${row.lastScanError})` : row.lastScannedAt ? `scanned ${new Date(row.lastScannedAt).toLocaleString()}` : 'not scanned yet'}. Rescanned daily.
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
