import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { AlertCircle, ArrowLeft, FileText, Search, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Badge } from '~/components/ui/badge';
import { Skeleton } from '~/components/ui/skeleton';
import { Button } from '~/components/ui/button';
import { api } from '~/lib/api';
import { QueryErrorState } from '~/components/query-error-state';
import { useProject } from '~/lib/project-context';

export const Route=createFileRoute('/$organizationSlug/p/$projectSlug/errors/$fingerprint')({component:ErrorDetail});
interface ErrorEntry { fingerprint:string; errorMessage:string; errorType:string; service:string; count:number; lastSeen:string; traceId?:string; spanId?:string; exception?:string; }
interface LogEntry { id:string; timestamp:string; level:string; message:string; }

function ErrorDetail(){
  const {organizationSlug,projectSlug,fingerprint}=Route.useParams();
  const {projectId}=useProject();
  const [findingCreated,setFindingCreated]=useState(false);
  const {data:errors,isLoading,isError,refetch}=useQuery({queryKey:['dashboard-errors',projectId],queryFn:()=>api.get<ErrorEntry[]>(`/projects/${projectId}/dashboard/errors`),enabled:!!projectId});
  const error=errors?.find((item)=>item.fingerprint===decodeURIComponent(fingerprint));
  const logs=useQuery({queryKey:['error-logs',projectId,error?.traceId],queryFn:()=>api.get<{data:LogEntry[]}>(`/projects/${projectId}/logs?traceId=${encodeURIComponent(error?.traceId??'')}&limit=12`),enabled:!!projectId&&!!error?.traceId});
  const finding=async()=>{if(!projectId||!error)return; await api.post(`/projects/${projectId}/detections/run`,{}); setFindingCreated(true);};

  if(!projectId)return <Card><CardContent className="p-10 text-center">Choose a project</CardContent></Card>;
  if(isError)return <QueryErrorState onRetry={()=>void refetch()}/>;
  if(isLoading)return <div className="space-y-4"><Skeleton className="h-24"/><Skeleton className="h-72"/></div>;
  if(!error)return <Card><CardContent className="p-10 text-center"><p className="font-medium">Error group not found</p><Link to="/$organizationSlug/p/$projectSlug/errors" params={{organizationSlug,projectSlug}} className="mt-2 inline-block text-sm underline">Back to errors</Link></CardContent></Card>;

  return <div className="min-h-full space-y-5 pb-8">
    <Link to="/$organizationSlug/p/$projectSlug/errors" params={{organizationSlug,projectSlug}} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4"/>Errors</Link>
    <header><p className="text-xs font-semibold uppercase tracking-[.14em] text-[#16931F]">Error detail</p><h1 className="mt-1 text-2xl font-semibold">{error.errorMessage}</h1><p className="mt-1 font-mono text-xs text-muted-foreground">{error.fingerprint}</p></header>
    <div className="flex flex-wrap gap-2">
      {error.traceId&&<Link to="/$organizationSlug/p/$projectSlug/trace/$traceId" params={{organizationSlug,projectSlug,traceId:error.traceId}}><Button variant="outline" size="sm"><Search className="mr-2 h-3.5 w-3.5"/>View trace</Button></Link>}
      <Button variant="outline" size="sm" onClick={()=>void finding()} disabled={findingCreated}>{findingCreated?'Finding queued':'Create finding'}</Button>
      {findingCreated&&<Link to="/$organizationSlug/p/$projectSlug/detections" params={{organizationSlug,projectSlug}}><Button variant="outline" size="sm"><ExternalLink className="mr-2 h-3.5 w-3.5"/>Open findings</Button></Link>}
    </div>
    <section className="grid gap-4 lg:grid-cols-2">
      <Card className="border-border shadow-none"><CardHeader><CardTitle className="text-base">Exception context</CardTitle></CardHeader><CardContent className="grid gap-4 sm:grid-cols-2"><Fact label="Type" value={error.errorType}/><Fact label="Service" value={error.service}/><Fact label="Occurrences" value={error.count.toLocaleString()}/><Fact label="Last seen" value={new Date(error.lastSeen).toLocaleString()}/><Fact label="Trace ID" value={error.traceId??'No trace correlated'}/><Fact label="Span ID" value={error.spanId??'No span correlated'}/>{error.exception&&<div className="sm:col-span-2"><p className="text-xs text-muted-foreground">Exception</p><pre className="mt-2 whitespace-pre-wrap rounded-lg bg-muted p-3 text-xs">{error.exception}</pre></div>}</CardContent></Card>
      <Card className="border-border shadow-none"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><FileText className="h-4 w-4"/>Correlated logs</CardTitle></CardHeader><CardContent className="p-0">{!error.traceId?<p className="p-6 text-sm text-muted-foreground">No trace is attached to this error group.</p>:logs.isLoading?<div className="p-5"><Skeleton className="h-24"/></div>:!logs.data?.data.length?<p className="p-6 text-sm text-muted-foreground">No correlated logs found.</p>:logs.data.data.map(log=><div key={log.id} className="border-t p-3 first:border-0"><div className="flex items-center gap-2"><Badge variant="outline">{log.level}</Badge><span className="font-mono text-[10px] text-muted-foreground">{new Date(log.timestamp).toLocaleTimeString()}</span></div><p className="mt-1 text-xs">{log.message}</p></div>)}</CardContent></Card>
    </section>
  </div>;
}
function Fact({label,value}:{label:string;value:string}){return <div><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 break-all font-mono text-xs">{value}</p></div>;}
