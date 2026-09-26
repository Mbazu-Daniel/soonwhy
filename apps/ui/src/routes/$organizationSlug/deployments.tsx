import { createFileRoute } from '@tanstack/react-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Rocket, GitCommitHorizontal, Plus, CircleCheck, CircleX, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Badge } from '~/components/ui/badge';
import { api } from '~/lib/api';
import { useProject } from '~/lib/project-context';
import { QueryErrorState } from '~/components/query-error-state';

export const Route = createFileRoute('/$organizationSlug/deployments')({ component: Deployments });

interface Service { id:string; name:string; }
interface Environment { id:string; name:string; slug:string; kind:string; }
interface Deployment { id:string; serviceId:string; environmentId:string; version:string|null; commitSha:string|null; status:string; deployedAt:string; }

function Deployments() {
  const { projectId } = useProject();
  const [serviceId,setServiceId]=useState('');
  const [environmentId,setEnvironmentId]=useState('');
  const [version,setVersion]=useState('');
  const [commitSha,setCommitSha]=useState('');
  const services=useQuery({queryKey:['services',projectId],queryFn:()=>api.get<Service[]>(`/services?projectId=${projectId}`),enabled:!!projectId});
  const environments=useQuery({queryKey:['environments',projectId],queryFn:()=>api.get<Environment[]>(`/environments?projectId=${projectId}`),enabled:!!projectId});
  const deployments=useQuery({queryKey:['deployments',serviceId],queryFn:()=>api.get<Deployment[]>(`/deployments?serviceId=${serviceId}`),enabled:!!serviceId});
  const create=useMutation({mutationFn:()=>api.post<Deployment>('/deployments',{serviceId,environmentId,version:version.trim()||undefined,commitSha:commitSha.trim()||undefined,status:'active'}),onSuccess:()=>{setVersion('');setCommitSha('');void deployments.refetch();}});
  if(!projectId)return <Card><CardContent className="p-10 text-center">Choose a project</CardContent></Card>;
  if(services.isError||environments.isError)return <QueryErrorState onRetry={()=>{void services.refetch();void environments.refetch();}} />;
  return <div className="mx-auto w-full space-y-6 pb-10">
    <h1 className="sr-only">Deployments</h1>
    <Card className="border-[#242426] bg-[#0B0B0C] shadow-none"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Plus className="h-4 w-4 text-[#ACFC15]"/>Record deployment</CardTitle></CardHeader><CardContent className="grid gap-3 md:grid-cols-2 lg:grid-cols-5"><select value={serviceId} onChange={e=>setServiceId(e.target.value)} className="h-10 rounded-md border border-[#242426] bg-[#151517] px-3 text-sm"><option value="">Service</option>{services.data?.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select><select value={environmentId} onChange={e=>setEnvironmentId(e.target.value)} className="h-10 rounded-md border border-[#242426] bg-[#151517] px-3 text-sm"><option value="">Environment</option>{environments.data?.map(e=><option key={e.id} value={e.id}>{e.name}</option>)}</select><Input placeholder="Version / release" value={version} onChange={e=>setVersion(e.target.value)}/><Input placeholder="Commit SHA" value={commitSha} onChange={e=>setCommitSha(e.target.value)}/><Button onClick={()=>create.mutate()} disabled={!serviceId||!environmentId||create.isPending}><Rocket className="mr-2 h-4 w-4"/>Record</Button></CardContent></Card>
    <Card className="overflow-hidden border-[#242426] bg-[#0B0B0C] shadow-none"><CardHeader className="border-b bg-[#151517]"><CardTitle className="text-base">{serviceId?'Deployment history':'Select a service'}</CardTitle></CardHeader><CardContent className="p-0">{serviceId&&!deployments.data?.length?<div className="p-10 text-center text-sm text-[#989898]">No deployments recorded for this service.</div>:<div className="divide-y divide-[#242426]">{deployments.data?.map(d=><div key={d.id} className="flex flex-wrap items-center gap-4 p-4"><div className="grid h-9 w-9 place-items-center rounded-lg bg-secondary"><Rocket className="h-4 w-4"/></div><div className="min-w-0 flex-1"><p className="text-sm font-medium">{d.version??'Unversioned release'}</p><p className="mt-1 font-mono text-xs text-[#989898]">{d.commitSha??'No commit SHA'} · {new Date(d.deployedAt).toLocaleString()}</p></div><Badge variant="outline">{d.status}</Badge>{d.status==='active'?<CircleCheck className="h-4 w-4 text-[#16931F]"/>:d.status==='failed'?<CircleX className="h-4 w-4 text-[#8A1C13]"/>:<RotateCcw className="h-4 w-4 text-[#713F12]"/>}</div>)}</div>}</CardContent></Card>
  </div>;
}