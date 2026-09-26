import { createFileRoute } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, KeyRound, Loader2, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { api } from '~/lib/api';
import { useProject } from '~/lib/project-context';
import { QueryErrorState } from '~/components/query-error-state';

export const Route = createFileRoute('/$organizationSlug/api-keys')({ component: ApiKeysPage });
interface ApiKey { id:string; name:string; prefix:string; scopes:string[]; expiresAt:string|null; lastUsedAt:string|null; createdAt:string; key?:string; }

function ApiKeysPage() {
  const { projectId } = useProject();
  const qc = useQueryClient();
  const [name,setName] = useState('Default ingestion key');
  const [created,setCreated] = useState<ApiKey|null>(null);
  const keys = useQuery({ queryKey:['api-keys',projectId], queryFn:()=>api.get<ApiKey[]>('/api-keys?projectId='+encodeURIComponent(projectId!)), enabled:!!projectId });
  const create = useMutation({ mutationFn:()=>api.post<ApiKey>('/api-keys?projectId='+encodeURIComponent(projectId!),{name:name.trim()||'Ingestion key'}), onSuccess:k=>{setCreated(k);void qc.invalidateQueries({queryKey:['api-keys',projectId]});} });
  const revoke = useMutation({ mutationFn:(id:string)=>api.delete('/api-keys/'+id), onSuccess:()=>void qc.invalidateQueries({queryKey:['api-keys',projectId]}) });
  if(!projectId) return <Card><CardContent className="p-10 text-center"><p className="font-medium">Choose a project</p><p className="mt-1 text-sm text-muted-foreground">API keys belong to a specific project.</p></CardContent></Card>;
  return <div className="mx-auto w-full max-w-5xl space-y-6 pb-10">
    <header><p className="text-xs font-semibold uppercase tracking-[.14em] text-[#16931F]">Project access</p><h1 className="mt-1 text-2xl font-semibold tracking-tight">API keys</h1><p className="mt-1 text-sm text-muted-foreground">Create ingestion credentials for the currently selected project. A key cannot read telemetry from another project.</p></header>
    <Card className="border-[#242426] bg-[#0B0B0C] shadow-none"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><KeyRound className="h-4 w-4 text-[#ACFC15]"/>Create project key</CardTitle></CardHeader><CardContent className="flex flex-col gap-3 sm:flex-row"><Input value={name} onChange={e=>setName(e.target.value)} placeholder="Production ingestion"/><Button onClick={()=>create.mutate()} disabled={create.isPending}>{create.isPending?<Loader2 className="animate-spin"/>:<Plus/>}Create key</Button></CardContent></Card>
    {created?.key&&<Card className="border-amber-300 bg-amber-50 shadow-none"><CardContent className="p-5"><p className="font-semibold text-amber-950">Copy this key now</p><p className="mt-1 text-xs text-amber-900">The raw secret is only returned during creation.</p><div className="mt-3 flex gap-2"><code className="min-w-0 flex-1 break-all rounded-md bg-[#182012] px-3 py-2 text-xs text-white">{created.key}</code><Button variant="outline" size="icon" onClick={()=>void navigator.clipboard?.writeText(created.key!)}><Copy/></Button></div></CardContent></Card>}
    {keys.isError?<QueryErrorState onRetry={()=>void keys.refetch()}/>:<Card className="overflow-hidden border-[#242426] bg-[#0B0B0C] shadow-none"><CardHeader className="border-b border-[#242426]"><CardTitle className="text-base">Project keys</CardTitle></CardHeader><CardContent className="p-0">{!keys.data?.length?<div className="p-10 text-center text-sm text-muted-foreground">No API keys for this project.</div>:<div className="divide-y divide-[#242426]">{keys.data.map(k=><div key={k.id} className="flex items-center gap-4 p-4"><KeyRound className="h-4 w-4 shrink-0 text-[#ACFC15]"/><div className="min-w-0 flex-1"><p className="text-sm font-medium">{k.name}</p><p className="font-mono text-xs text-muted-foreground">{k.prefix}•••••••• · {k.lastUsedAt?'Last used '+new Date(k.lastUsedAt).toLocaleString():'Never used'}</p></div><Button variant="ghost" className="text-red-700" onClick={()=>revoke.mutate(k.id)} disabled={revoke.isPending}><Trash2 className="mr-2 h-4 w-4"/>Revoke</Button></div>)}</div>}</CardContent></Card>}
  </div>;
}
