import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { Bot, KeyRound, ShieldCheck } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Button } from '~/components/ui/button';

export const Route = createFileRoute('/$organizationSlug/ai')({ component: AIAgentPage });

export function AIAgentPage() {
  const [provider, setProvider] = useState('OpenAI');
  const [saved, setSaved] = useState(false);
  return (
    <div className="mx-auto w-full max-w-5xl space-y-5 px-4 py-5 sm:px-6 sm:py-7">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[.14em] text-[#ACFC15]">AI agent</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#F6F6F6]">Bring your own AI key.</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#989898]">Connect your preferred model provider so SoonWhy can explain telemetry without making your model choice a platform dependency.</p>
      </header>
      <Card className="rounded-xl border-[#242426] bg-[#0B0B0C]">
        <CardHeader><CardTitle className="flex items-center gap-2"><Bot className="h-4 w-4 text-[#ACFC15]"/>Provider</CardTitle></CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-2 sm:grid-cols-3">
            {['OpenAI','Anthropic','Google'].map(item => <button key={item} type="button" onClick={() => setProvider(item)} className={`rounded-lg border px-3 py-2 text-left text-sm ${provider === item ? 'border-[#ACFC15] bg-[#ACFC15]/5 text-[#F6F6F6]' : 'border-[#242426] text-[#989898]'}`}>{item}</button>)}
          </div>
          <div className="space-y-2"><Label>API key</Label><Input type="password" placeholder={`Paste your ${provider} API key`} className="border-[#242426] bg-[#151517]" /></div>
          <div className="flex items-start gap-3 rounded-lg border border-[#242426] bg-[#151517] p-4 text-xs text-[#989898]"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#ACFC15]"/><span>Keys should be encrypted at rest and never returned in plaintext after saving. This UI is ready for the provider credential endpoint.</span></div>
          <Button onClick={() => setSaved(true)} className="bg-[#ACFC15] text-[#040405] hover:bg-[#ACFC15]/90"><KeyRound className="mr-2 h-4 w-4"/>{saved ? 'Saved' : 'Save provider key'}</Button>
        </CardContent>
      </Card>
    </div>
  );
}
