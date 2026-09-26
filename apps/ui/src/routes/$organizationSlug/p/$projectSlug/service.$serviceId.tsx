import { createFileRoute, Link } from '@tanstack/react-router';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Activity, ArrowLeft, ExternalLink, Users, GitBranch, Database, AlertTriangle, FileText, Clock3 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Badge } from '~/components/ui/badge';
import { Skeleton } from '~/components/ui/skeleton';
import { api } from '~/lib/api';
import { QueryErrorState } from '~/components/query-error-state';
import { useProject } from '~/lib/project-context';
import { TimeRangeControl, telemetryRangeParams, type TelemetryRange } from '~/components/telemetry/time-range-control';

export const Route=createFileRoute('/$organizationSlug/p/$projectSlug/service/$serviceId')({component:ServiceDetail});

interface Service { id:string; name:string; slug:string; language:string|null; framework:string|null; repositoryUrl:string|null; repositoryProvider:string|null; repositoryBranch:string|null; owner:{id:string;name:string|null;email:string}|null; team:{id:string;name:string;slug:string}|null; }
interface ServiceTelemetry { service:string; requestCount:number; errorCount:number; errorRate:number; p95Latency:number; }
interface LogEntry { id:string; timestamp:string; level:string; message:string; }

function ServiceDetail(){
  const { organizationSlug, projectSlug, serviceId } = Route.useParams();
  const { projectId } = useProject();
  const [range,setRange]=useState<TelemetryRange>('24h');
  const rangeParams=telemetryRangeParams(range);
  const rangeQuery=new URLSearchParams(rangeParams).toString();

  const {data:service,isLoading,isError,refetch}=useQuery({queryKey:['service',projectId,serviceId],queryFn:()=>api.get<Service>(`/projects/${projectId}/services/${serviceId}`),enabled:!!projectId&&!!serviceId,placeholderData:keepPreviousData});
  const {data:telemetry}=useQuery({queryKey:['service-telemetry',projectId,range],queryFn:()=>api.get<ServiceTelemetry[]>(`/projects/${projectId}/dashboard/services?${rangeQuery}`),enabled:!!projectId,placeholderData:keepPreviousData});
  const {data:errors}=useQuery({queryKey:['service-errors',projectId,serviceId],queryFn:()=>api.get<Array<{fingerprint:string;errorMessage:string;errorType:string;service:string;count:number;lastSeen:string}>>(`/projects/${projectId}/dashboard/errors?service=${encodeURIComponent(serviceId)}&${rangeQuery}`),enabled:!!projectId&&!!serviceId});
  const {data:logs}=useQuery({queryKey:['service-logs',projectId,serviceId,range],queryFn:()=>api.get<{data:LogEntry[]}>(`/projects/${projectId}/logs?service=${encodeURIComponent(service?.name??'')}&limit=8&${rangeQuery}`),enabled:!!projectId&&!!service?.name,placeholderData:keepPreviousData});

  if(!projectId)return <Empty organizationSlug={organizationSlug} projectSlug={projectSlug}/>;
  if(isError)return <QueryErrorState onRetry={() => void refetch()} />;
  if(isLoading)return <div className="space-y-4"><Skeleton className="h-24"/><Skeleton className="h-64"/></div>;
  const telemetryStale = !telemetry && !!metrics;
  const errorsStale = !errors && serviceErrors.length > 0;
  const logsStale = !logs && recentLogs.length > 0;
  if(!service)return <Empty notFound organizationSlug={organizationSlug} projectSlug={projectSlug}/>;

  const metrics=telemetry?.find((item)=>item.service===service.name);
  const recentLogs=logs?.data??[];
  const serviceErrors=errors?.filter((error)=>error.service===service.name).slice(0,5)??[];

  return <div className="min-h-full space-y-5 pb-8">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <Link to="/$organizationSlug/p/$projectSlug/services" params={{ organizationSlug, projectSlug }} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4"/>Services</Link>
      <TimeRangeControl value={range} onChange={setRange}/>
    </div>
    {(telemetryStale || errorsStale || logsStale) && <div className="rounded-xl border border-[#5A4A1C] bg-[#2A220F] px-4 py-3 text-xs text-[#D8C68A]">Some telemetry is temporarily unavailable. Showing the last successful service data.</div>}\n    <header className="flex items-start gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-secondary"><Activity className="h-5 w-5"/></span><div><p className="text-xs font-semibold uppercase tracking-[.14em] text-[#16931F]">Service detail</p><h1 className="mt-1 text-2xl font-semibold">{service.name}</h1><p className="font-mono text-xs text-muted-foreground">{service.slug}</p></div></header>
    <nav className="flex flex-wrap gap-1 rounded-xl border bg-muted/40 p-1" aria-label="Service telemetry">
      <span className="rounded-lg bg-background px-3 py-2 text-xs font-medium shadow-sm">Overview</span>
      <Link to="/$organizationSlug/p/$projectSlug/errors" params={{ organizationSlug, projectSlug }} className="rounded-lg px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-background hover:text-foreground">Errors</Link>
      <Link to="/$organizationSlug/p/$projectSlug/logs" params={{ organizationSlug, projectSlug }} search={{ service: service.name }} className="rounded-lg px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-background hover:text-foreground">Logs</Link>
      <Link to="/$organizationSlug/p/$projectSlug/traces" params={{ organizationSlug, projectSlug }} search={{ service: service.name }} className="rounded-lg px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-background hover:text-foreground">Traces</Link>
      <span className="rounded-lg px-3 py-2 text-xs font-medium text-muted-foreground">Attributes</span>
    </nav>
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Metric label="Requests" value={metrics?.requestCount.toLocaleString()??'—'} icon={Activity}/><Metric label="Error rate" value={metrics?`${metrics.errorRate}%`:'—'} icon={AlertTriangle}/><Metric label="P95 latency" value={metrics?`${metrics.p95Latency}ms`:'—'} icon={Clock3}/><Metric label="Errors" value={metrics?.errorCount.toLocaleString()??'—'} icon={Database}/></section>
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="border-border shadow-none"><CardHeader><CardTitle className="text-base">Source context</CardTitle></CardHeader><CardContent className="grid gap-5 md:grid-cols-2"><div><p className="text-xs text-muted-foreground">Repository</p>{service.repositoryUrl?<a href={service.repositoryUrl} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-2 text-sm font-medium text-[#16931F]">{service.repositoryProvider??'Repository'}<ExternalLink className="h-3 w-3"/></a>:<p className="mt-1 text-sm">Not linked</p>}</div><div><p className="text-xs text-muted-foreground">Branch</p><p className="mt-1 flex items-center gap-2 font-mono text-sm"><GitBranch className="h-3.5 w-3.5"/>{service.repositoryBranch??'Not configured'}</p></div><div><p className="text-xs text-muted-foreground">Runtime</p><p className="mt-1 text-sm font-medium">{service.language??'Unknown'} · {service.framework??'Framework not set'}</p></div><div><p className="text-xs text-muted-foreground">Ownership</p><p className="mt-1 text-sm font-medium">{service.owner?.name??service.owner?.email??'Unassigned'} · {service.team?.name??'No team'}</p></div></CardContent></Card>
      <Card className="border-border shadow-none"><CardHeader><CardTitle className="text-base">Recent errors</CardTitle></CardHeader><CardContent className="p-0">{!serviceErrors.length?<p className="p-6 text-sm text-muted-foreground">No errors recorded in the current result set.</p>:serviceErrors.map((error)=><div key={error.fingerprint} className="flex gap-3 border-t p-4 first:border-0"><AlertTriangle className="h-4 w-4 shrink-0 text-[#8A1C13]"/><div className="min-w-0 flex-1"><p className="truncate text-sm">{error.errorMessage}</p><p className="mt-1 text-xs text-muted-foreground">{error.count} occurrence{error.count===1?'':'s'} · {new Date(error.lastSeen).toLocaleString()}</p></div></div>)}</CardContent></Card>
    </div>
    <Card className="border-border shadow-none"><CardHeader><CardTitle className="text-base">Recent telemetry</CardTitle><p className="text-xs text-muted-foreground">Logs emitted by {service.name} in the selected range.</p></CardHeader><CardContent className="p-0">{!recentLogs.length?<p className="p-6 text-sm text-muted-foreground">No recent logs available.</p>:recentLogs.map(log=><div key={log.id} className="flex items-center gap-3 border-t p-4 first:border-0"><FileText className="h-4 w-4 text-[#16931F]"/><span className="font-mono text-[11px] text-muted-foreground">{new Date(log.timestamp).toLocaleTimeString()}</span><Badge variant="outline">{log.level}</Badge><span className="truncate text-sm">{log.message}</span></div>)}</CardContent></Card>
  </div>;
}

function Metric({icon:Icon,label,value}:{icon:typeof Activity;label:string;value:string}){return <Card className="border-border shadow-none"><CardContent className="p-4"><div className="flex items-center justify-between"><span className="text-xs text-muted-foreground">{label}</span><Icon className="h-4 w-4 text-[#16931F]"/></div><p className="mt-2 text-xl font-semibold">{value}</p></CardContent></Card>;}
function Empty({notFound=false,organizationSlug,projectSlug}:{notFound?:boolean;organizationSlug:string;projectSlug:string}){return <Card><CardContent className="p-10 text-center"><p className="font-medium">{notFound?'Service not found':'Choose a project'}</p><Link to="/$organizationSlug/p/$projectSlug/services" params={{ organizationSlug, projectSlug }} className="mt-2 inline-block text-sm text-[#16931F] underline">Back to services</Link></CardContent></Card>;}
