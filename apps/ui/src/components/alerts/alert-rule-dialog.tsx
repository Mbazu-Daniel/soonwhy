import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '~/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '~/components/ui/dialog';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select';
import { FINDING_CATEGORIES, FINDING_CATEGORY_LABELS } from '~/lib/findings.constants';
import type { FindingCategory } from '~/lib/findings.types';
import type { AlertRule, AlertRuleCondition, AlertRuleInput, NotificationChannel } from '~/lib/types';
import {
  ALERT_AGGREGATIONS,
  ALERT_METRICS,
  ALERT_OPERATORS,
  ALERT_SEVERITIES,
  ALERT_STATUSES,
  ALERT_WINDOWS,
  AUTO_CATEGORY,
  emptyAlertCondition,
} from './alert-constants';

interface AlertRuleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rule: AlertRule | null;
  channels?: NotificationChannel[];
  pending: boolean;
  error: string | null;
  onSubmit: (input: AlertRuleInput) => void;
}

export function AlertRuleDialog({
  open,
  onOpenChange,
  rule,
  channels,
  pending,
  error,
  onSubmit,
}: AlertRuleDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [minSeverity, setMinSeverity] = useState('medium');
  const [status, setStatus] = useState('active');
  const [dedupeWindowSeconds, setDedupeWindowSeconds] = useState('300');
  const [findingCategory, setFindingCategory] = useState(AUTO_CATEGORY);
  const [channelIds, setChannelIds] = useState<string[]>([]);
  const [conditions, setConditions] = useState<AlertRuleCondition[]>([emptyAlertCondition()]);

  useEffect(() => {
    if (!open) return;
    setName(rule?.name ?? '');
    setDescription(rule?.description ?? '');
    setMinSeverity(rule?.minSeverity ?? 'medium');
    setStatus(rule?.status ?? 'active');
    setDedupeWindowSeconds(String(rule?.dedupeWindowSeconds ?? 300));
    setFindingCategory(rule?.findingCategory ?? AUTO_CATEGORY);
    setChannelIds(rule?.channelIds ?? []);
    setConditions(rule?.conditions.length ? rule.conditions.map(cloneCondition) : [emptyAlertCondition()]);
  }, [open, rule]);

  function updateCondition(index: number, patch: Partial<AlertRuleCondition>) {
    setConditions((current) => current.map((condition, i) => (i === index ? { ...condition, ...patch } : condition)));
  }

  function submit() {
    const parsedDedupe = Number(dedupeWindowSeconds);
    onSubmit({
      name: name.trim(),
      description: description.trim() || undefined,
      minSeverity,
      channelIds,
      status,
      dedupeWindowSeconds: Number.isFinite(parsedDedupe) && parsedDedupe > 0 ? parsedDedupe : 300,
      findingCategory: findingCategory === AUTO_CATEGORY ? null : (findingCategory as FindingCategory),
      conditions: conditions.map((condition) => ({
        type: condition.type || 'threshold',
        metric: condition.metric,
        operator: condition.operator,
        value: Number(condition.value),
        window: condition.window || '5m',
        aggregation: condition.aggregation || 'avg',
        description: condition.description?.trim() || undefined,
      })),
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{rule ? 'Edit alert rule' : 'Create alert rule'}</DialogTitle>
          <DialogDescription>Fire when a metric crosses a threshold over a time window.</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="alert-name">Name</Label>
            <Input id="alert-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Checkout P95 latency" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="alert-description">Description</Label>
            <Input id="alert-description" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Notify when checkout latency is too high" />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>Minimum severity</Label>
              <Select value={minSeverity} onValueChange={setMinSeverity}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ALERT_SEVERITIES.map((severity) => (
                    <SelectItem key={severity} value={severity}>{severity}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ALERT_STATUSES.map((item) => (
                    <SelectItem key={item} value={item}>{item}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="alert-dedupe">Dedupe window (seconds)</Label>
              <Input id="alert-dedupe" type="number" min={1} value={dedupeWindowSeconds} onChange={(event) => setDedupeWindowSeconds(event.target.value)} />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Conditions</Label>
              <Button type="button" variant="outline" size="sm" onClick={() => setConditions((current) => [...current, emptyAlertCondition()])}>
                <Plus className="h-3.5 w-3.5" /> Add condition
              </Button>
            </div>
            {conditions.map((condition, index) => (
              <div key={`${condition.metric}-${condition.operator}-${index}`} className="space-y-3 rounded-lg border border-border p-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Metric</Label>
                    <Select value={condition.metric} onValueChange={(metric) => updateCondition(index, { metric })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ALERT_METRICS.map((metric) => (
                          <SelectItem key={metric.value} value={metric.value}>{metric.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-[auto_1fr] gap-2">
                    <div className="space-y-2">
                      <Label>Operator</Label>
                      <Select value={condition.operator} onValueChange={(operator) => updateCondition(index, { operator })}>
                        <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {ALERT_OPERATORS.map((operator) => (
                            <SelectItem key={operator.value} value={operator.value}>{operator.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`alert-threshold-${index}`}>Threshold</Label>
                      <Input
                        id={`alert-threshold-${index}`}
                        type="number"
                        value={condition.value ?? ''}
                        onChange={(event) => updateCondition(index, { value: event.target.value === '' ? undefined : Number(event.target.value) })}
                        required
                      />
                    </div>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
                  <div className="space-y-2">
                    <Label>Window</Label>
                    <Select value={condition.window ?? '5m'} onValueChange={(window) => updateCondition(index, { window })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ALERT_WINDOWS.map((window) => (
                          <SelectItem key={window} value={window}>{window}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Aggregation</Label>
                    <Select value={condition.aggregation ?? 'avg'} onValueChange={(aggregation) => updateCondition(index, { aggregation })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ALERT_AGGREGATIONS.map((aggregation) => (
                          <SelectItem key={aggregation} value={aggregation}>{aggregation}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {conditions.length > 1 ? (
                    <Button type="button" variant="ghost" className="self-end text-[#F2555A] hover:bg-[#F2555A]/10 hover:text-[#F2555A]" onClick={() => setConditions((current) => current.filter((_, i) => i !== index))} aria-label="Remove condition">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>

          {channels ? (
            <div className="space-y-2">
              <Label>Notification channels</Label>
              {channels.length === 0 ? (
                <p className="text-xs text-muted-foreground">No channels yet. Create one in the Channels tab, then attach it here.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {channels.map((channel) => {
                    const selected = channelIds.includes(channel.id);
                    return (
                      <Button
                        key={channel.id}
                        type="button"
                        size="sm"
                        variant={selected ? 'default' : 'outline'}
                        onClick={() => setChannelIds((current) => (selected ? current.filter((id) => id !== channel.id) : [...current, channel.id]))}
                      >
                        {channel.name}
                      </Button>
                    );
                  })}
                </div>
              )}
            </div>
          ) : null}

          {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
          <div className="space-y-2">
            <Label>File findings under</Label>
            <Select value={findingCategory} onValueChange={setFindingCategory}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={AUTO_CATEGORY}>Choose from the metric</SelectItem>
                {FINDING_CATEGORIES.map((category) => (
                  <SelectItem key={category} value={category}>{FINDING_CATEGORY_LABELS[category]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">When this alert fires it is added to Findings for review, and resolved when the alert recovers.</p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={pending || !name.trim()}>{pending ? 'Saving...' : rule ? 'Update rule' : 'Create rule'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function cloneCondition(condition: AlertRuleCondition): AlertRuleCondition {
  return {
    type: condition.type,
    metric: condition.metric,
    operator: condition.operator,
    value: condition.value,
    window: condition.window,
    aggregation: condition.aggregation,
    description: condition.description,
  };
}
