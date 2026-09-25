import { createFileRoute } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Bot, KeyRound, ShieldCheck, Trash2, CheckCircle2, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Button } from '~/components/ui/button';
import { api } from '~/lib/api';
import { QueryErrorState } from '~/components/query-error-state';

export const Route = createFileRoute('/$organizationSlug/ai')({ component: AIAgentPage });
interface AiConfig { configured: boolean; provider?: string; model?: string; baseUrl?: string | null; keyHint?: string; updatedAt?: string | null; }
const providers = [{ id: 'openai', label: 'OpenAI', model: 'gpt-4.1-mini' }, { id: 'anthropic', label: 'Anthropic', model: 'claude-sonnet-4-5' }, { id: 'google', label: 'Google', model: 'gemini-2.5-flash' }] as const;

export function AIAgentPage() {
  const queryClient = useQueryClient();
  const { data, isError, refetch } = useQuery({ queryKey: ['ai-config'], queryFn: () => api.get<AiConfig>('/ai/config') });
  const [provider, setProvider] = useState('openai'); const [model, setModel] = useState('gpt-4.1-mini'); const [apiKey, setApiKey] = useState(''); const [baseUrl, setBaseUrl] = useState(''); const [saved, setSaved] = useState(false);
  useEffect(() => { if (!data?.configured) return; setProvider(data.provider ?? 'openai'); setModel(data.model ?? 'gpt-4.1-mini'); setBaseUrl(data.baseUrl ?? ''); }, [data]);

  const save = useMutation({ mutationFn: () => api.put<AiConfig>('/ai/config', { provider, model, apiKey, baseUrl: baseUrl || null }), onSuccess: () => { setApiKey(''); setSaved(true); void queryClient.invalidateQueries({ queryKey: ['ai-config'] }); }});
  const remove = useMutation({ mutationFn: () => api.delete('/ai/config'), onSuccess: () => { setSaved(false); setApiKey(''); void queryClient.invalidateQueries({ queryKey: ['ai-config'] }); }});
  if (isError) return <QueryErrorState onRetry={() => void refetch()} />;

  return <div className="mx-auto w-full max-w-5xl space-y-5 px-4 py-5 sm:px-6 sm:py-7">
    <header><p className="text-xs font-semibold uppercase tracking-[.14em] text-[#ACFC15]">AI agent</p><h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#F6F6F6]">Bring your own AI key.</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-[#989898]">Connect a provider for SoonWhy RCA. The key is encrypted before storage and never returned to the browser.</p></header>
    <Card className="rounded-xl border-[#242426] bg-[#0B0B0C]"><CardHeader><CardTitle className="flex items-center gap-2"><Bot className="h-4 w-4 text-[#ACFC15]" />Provider</CardTitle></CardHeader><CardContent className="space-y-5">
      <div className="grid gap-2 sm:grid-cols-3">{providers.map((item) => <button key={item.id} type="button" onClick={() => { setProvider(item.id); setModel(item.model); }} className={`rounded-lg border px-3 py-3 text-left text-sm transition-colors ${provider === item.id ? 'border-[#ACFC15] bg-[#ACFC15]/5 text-[#F6F6F6]' : 'border-[#242426] text-[#989898] hover:bg-[#151517]'}`}><span className="block font-medium">{item.label}</span><span className="mt-1 block text-[11px] text-[#6E6E70]">Default {item.model}</span></button>)}</div>
      {data?.configured && <div className="flex items-center gap-2 rounded-lg border border-[#34451D] bg-[#11170D] px-3 py-2 text-xs text-[#ACFC15]"><CheckCircle2 className="h-3.5 w-3.5" />Connected · {data.provider} · {data.model} · key ending in {data.keyHint}</div>}
      <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Model</Label><Input value={model} onChange={(e) => setModel(e.target.value)} className="border-[#242426] bg-[#151517]" /></div><div className="space-y-2"><Label>API key</Label><Input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder={data?.configured ? 'Enter a new key to rotate' : 'Paste your API key'} className="border-[#242426] bg-[#151517]" /></div></div>
      <div className="space-y-2"><Label>Base URL <span className="text-[#6E6E70]">(optional)</span></Label><Input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://api.openai.com/v1" className="border-[#242426] bg-[#151517]" /></div>
      <div className="flex items-start gap-3 rounded-lg border border-[#242426] bg-[#151517] p-4 text-xs text-[#989898]"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#ACFC15]" /><span>Credentials are encrypted at rest. Only provider, model and a key hint are returned after saving.</span></div>
      {(save.isError || remove.isError) && <div className="flex items-center gap-2 text-xs text-[#F28B82]"><AlertCircle className="h-3.5 w-3.5" />{(save.error as Error)?.message || (remove.error as Error)?.message}</div>}
      <div className="flex flex-wrap gap-2"><Button onClick={() => save.mutate()} disabled={save.isPending || !apiKey.trim()} className="bg-[#ACFC15] text-[#040405] hover:bg-[#ACFC15]/90"><KeyRound className="mr-2 h-4 w-4" />{save.isPending ? 'Saving…' : saved ? 'Saved' : 'Save provider key'}</Button>{data?.configured && <Button variant="outline" onClick={() => remove.mutate()} disabled={remove.isPending} className="border-[#242426]"><Trash2 className="mr-2 h-4 w-4" />Remove key</Button>}</div>
    </CardContent></Card>
  </div>;
}
