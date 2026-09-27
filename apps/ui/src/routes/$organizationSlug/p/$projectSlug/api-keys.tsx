import { useMemo, useState, type FormEvent } from 'react';
import { Link, createFileRoute } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Copy, KeyRound, Loader2, Plus, Search, X } from 'lucide-react';
import { Button } from '~/components/ui/button';
import { Card, CardContent } from '~/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '~/components/ui/dialog';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Skeleton } from '~/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '~/components/ui/table';
import { QueryErrorState } from '~/components/query-error-state';
import { api } from '~/lib/api';
import { useProject } from '~/lib/project-context';
import type { ApiKey } from '~/lib/types';

export const Route = createFileRoute('/$organizationSlug/p/$projectSlug/api-keys')({ component: ApiKeysPage });

function ApiKeysPage() {
  const { orgSlug, projectSlug, projectId } = useProject();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [newKey, setNewKey] = useState<ApiKey | null>(null);
  const [copied, setCopied] = useState(false);

  const keys = useQuery({
    queryKey: ['api-keys', projectId],
    queryFn: () => api.get<ApiKey[]>(`/projects/${projectId}/api-keys`),
    enabled: !!projectId,
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/projects/${projectId}/api-keys/${encodeURIComponent(id)}`),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['api-keys', projectId] }),
  });

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const list = keys.data ?? [];
    if (!needle) return list;
    return list.filter((key) => key.name.toLowerCase().includes(needle) || key.prefix.toLowerCase().includes(needle));
  }, [keys.data, search]);

  async function copyKey() {
    if (!newKey?.key) return;
    await navigator.clipboard?.writeText(newKey.key);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  if (!projectId) {
    return (
      <Card className="border-dashed shadow-none">
        <CardContent className="p-12 text-center">
          <KeyRound className="mx-auto h-6 w-6 text-primary" />
          <p className="mt-3 text-sm font-medium">Choose a project</p>
          <p className="mt-1 text-xs text-muted-foreground">API keys belong to a specific project.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-10">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            <Link to="/$organizationSlug/p/$projectSlug/settings" params={{ organizationSlug: orgSlug!, projectSlug: projectSlug! }} className="hover:text-foreground">
              Settings
            </Link>
            <span className="px-2">/</span>
            API keys
          </p>
         
        </div>
        <Button className="shrink-0" onClick={() => setCreating(true)}>
          <Plus />
          Create key
        </Button>
      </header>

      {newKey?.key && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">Copy api key</p>
            <div className="mt-3 flex gap-2">
              <code className="min-w-0 flex-1 break-all rounded-md bg-black/40 px-3 py-2 font-mono text-xs text-amber-100">{newKey.key}</code>
              <Button variant="outline" size="icon" aria-label="Copy API key" className="border-amber-500/40 bg-transparent hover:bg-amber-500/20 hover:text-inherit" onClick={() => void copyKey()}>
                {copied ? <Check /> : <Copy />}
              </Button>
            </div>
            <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">{copied ? 'Copied.' : 'Keep this key in your secret manager.'}</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Dismiss"
            className="shrink-0 text-amber-700 hover:bg-amber-500/20 hover:text-amber-900 dark:text-amber-300 dark:hover:text-amber-100"
            onClick={() => {
              setNewKey(null);
              setCopied(false);
            }}
          >
            <X />
          </Button>
        </div>
      )}

      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label="Search API keys"
            placeholder="Search API keys..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {keys.isError ? (
        <QueryErrorState onRetry={() => void keys.refetch()} />
      ) : (
        <Card className="overflow-hidden shadow-none">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-5">Name</TableHead>
                <TableHead>Token</TableHead>
                <TableHead>Last used</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead className="w-28 pr-5" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {keys.isLoading ? (
                Array.from({ length: 3 }).map((_, index) => (
                  <TableRow key={index} className="hover:bg-transparent">
                    <TableCell colSpan={5}>
                      <Skeleton className="h-8" />
                    </TableCell>
                  </TableRow>
                ))
              ) : filtered.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={5} className="h-56 text-center">
                    <KeyRound className="mx-auto h-6 w-6 text-primary" />
                    <p className="mt-3 text-sm font-medium">{keys.data?.length ? 'No keys match your search' : 'No API keys yet'}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {keys.data?.length ? 'Try a different name or token prefix.' : 'Create a key to connect a shipper to this project.'}
                    </p>
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((key) => (
                  <TableRow key={key.id}>
                    <TableCell className="pl-5 font-medium">{key.name}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{key.prefix}••••••••</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{key.lastUsedAt ? formatAge(key.lastUsedAt) : 'Never'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{key.expiresAt ? new Date(key.expiresAt).toLocaleDateString() : 'Never'}</TableCell>
                    <TableCell className="pr-5 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-[#F2555A] hover:bg-[#F2555A]/10 hover:text-[#F2555A]"
                        disabled={remove.isPending}
                        onClick={() => remove.mutate(key.id)}
                        aria-label={`Revoke ${key.name}`}
                      >
                        Revoke
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      )}

      {creating && (
        <CreateKeyDialog
          projectId={projectId}
          onOpenChange={setCreating}
          onCreated={(key) => {
            setNewKey(key);
            setCopied(false);
          }}
        />
      )}
    </div>
  );
}

function CreateKeyDialog({
  projectId,
  onOpenChange,
  onCreated,
}: {
  projectId: string;
  onOpenChange: (open: boolean) => void;
  onCreated: (key: ApiKey) => void;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');

  const create = useMutation({
    mutationFn: () => api.post<ApiKey>(`/projects/${projectId}/api-keys`, { name: name.trim() || 'Ingestion key' }),
    onSuccess: (key) => {
      onCreated(key);
      void queryClient.invalidateQueries({ queryKey: ['api-keys', projectId] });
      onOpenChange(false);
    },
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    create.mutate();
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create API key</DialogTitle>
          <DialogDescription>The raw key is shown once, right after it is created.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="api-key-name">Name</Label>
            <Input
              id="api-key-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Production shipper"
              maxLength={100}
              autoFocus
            />
          </div>
          {create.isError && <p role="alert" className="text-sm text-destructive">Could not create the key. Try again.</p>}
          <Button type="submit" className="w-full" disabled={create.isPending}>
            {create.isPending ? <Loader2 className="animate-spin" /> : <Plus />}
            Create key
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function formatAge(value: string) {
  const age = Date.now() - new Date(value).getTime();
  if (!Number.isFinite(age) || age < 0) return 'Just now';
  const minutes = Math.floor(age / 60_000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}
