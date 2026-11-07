import { useEffect, useState } from 'react';
import { Button } from '~/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '~/components/ui/dialog';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select';

interface SyntheticProbe {
  id: number;
  name: string;
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string | null;
  expectedStatusCode: number;
  timeoutMs: number;
  intervalSeconds: number;
  region: string;
  enabled: boolean;
}

interface SyntheticProbeInput {
  name: string;
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
  expectedStatusCode: number;
  timeoutMs: number;
  intervalSeconds: number;
  region: string;
}

interface SyntheticProbeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  probe: SyntheticProbe | null;
  pending: boolean;
  error: string | null;
  onSubmit: (input: SyntheticProbeInput) => void;
}

const METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'HEAD', 'OPTIONS'] as const;
const REGIONS = ['us-east-1', 'us-west-2', 'eu-west-1', 'ap-southeast-1'] as const;

export function SyntheticProbeDialog({
  open,
  onOpenChange,
  probe,
  pending,
  error,
  onSubmit,
}: SyntheticProbeDialogProps) {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [method, setMethod] = useState('GET');
  const [headers, setHeaders] = useState('');
  const [body, setBody] = useState('');
  const [expectedStatusCode, setExpectedStatusCode] = useState('200');
  const [timeoutMs, setTimeoutMs] = useState('30000');
  const [intervalSeconds, setIntervalSeconds] = useState('60');
  const [region, setRegion] = useState('us-east-1');

  useEffect(() => {
    if (!open) return;
    setName(probe?.name ?? '');
    setUrl(probe?.url ?? '');
    setMethod(probe?.method ?? 'GET');
    setHeaders(probe?.headers ? JSON.stringify(probe.headers, null, 2) : '{}');
    setBody(probe?.body ?? '');
    setExpectedStatusCode(String(probe?.expectedStatusCode ?? 200));
    setTimeoutMs(String(probe?.timeoutMs ?? 30000));
    setIntervalSeconds(String(probe?.intervalSeconds ?? 60));
    setRegion(probe?.region ?? 'us-east-1');
  }, [open, probe]);

  function submit() {
    let parsedHeaders: Record<string, string> = {};
    try {
      parsedHeaders = headers ? JSON.parse(headers) : {};
    } catch {
      parsedHeaders = {};
    }

    onSubmit({
      name: name.trim(),
      url: url.trim(),
      method,
      headers: parsedHeaders,
      body: body.trim() || undefined,
      expectedStatusCode: Number(expectedStatusCode),
      timeoutMs: Number(timeoutMs),
      intervalSeconds: Number(intervalSeconds),
      region,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{probe ? 'Edit synthetic probe' : 'Create synthetic probe'}</DialogTitle>
          <DialogDescription>Monitor endpoint availability and response time from configured regions.</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="probe-name">Name</Label>
            <Input id="probe-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="API health check" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="probe-url">URL</Label>
            <Input id="probe-url" type="url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://api.example.com/health" required />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Method</Label>
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {METHODS.map((m) => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Region</Label>
              <Select value={region} onValueChange={setRegion}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {REGIONS.map((r) => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="probe-status">Expected status</Label>
              <Input id="probe-status" type="number" min={100} max={599} value={expectedStatusCode} onChange={(event) => setExpectedStatusCode(event.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="probe-timeout">Timeout (ms)</Label>
              <Input id="probe-timeout" type="number" min={1000} max={300000} value={timeoutMs} onChange={(event) => setTimeoutMs(event.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="probe-interval">Interval (seconds)</Label>
              <Input id="probe-interval" type="number" min={10} max={3600} value={intervalSeconds} onChange={(event) => setIntervalSeconds(event.target.value)} required />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="probe-headers">Headers (JSON)</Label>
            <Input id="probe-headers" value={headers} onChange={(event) => setHeaders(event.target.value)} placeholder='{"Authorization": "Bearer token"}' />
          </div>
          {(method === 'POST' || method === 'PUT') && (
            <div className="space-y-2">
              <Label htmlFor="probe-body">Body</Label>
              <Input id="probe-body" value={body} onChange={(event) => setBody(event.target.value)} placeholder="Request body" />
            </div>
          )}
          {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={pending || !name.trim() || !url.trim()}>{pending ? 'Saving...' : probe ? 'Update probe' : 'Create probe'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
