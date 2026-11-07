import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, Plus, Trash2 } from 'lucide-react';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Card, CardContent } from '~/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '~/components/ui/dialog';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '~/components/ui/table';
import { QueryErrorState } from '~/components/query-error-state';
import { api } from '~/lib/api';
import type { NotificationChannel } from '~/lib/types';

const CHANNEL_TYPES = ['email', 'slack', 'webhook'] as const;

interface NotificationChannelsPanelProps {
  projectId: string;
}

export function NotificationChannelsPanel({ projectId }: NotificationChannelsPanelProps) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<NotificationChannel | null>(null);

  const channels = useQuery({
    queryKey: ['notification-channels', projectId],
    queryFn: () => api.get<NotificationChannel[]>(`/projects/${projectId}/notifications/channels`),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/projects/${projectId}/notifications/channels/${encodeURIComponent(id)}`),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['notification-channels', projectId] }),
  });

  if (channels.isError) return <QueryErrorState onRetry={() => void channels.refetch()} />;

  const rows = channels.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => { setEditing(null); setOpen(true); }}>
          <Plus className="h-4 w-4" /> Create channel
        </Button>
      </div>
      {rows.length === 0 && !channels.isLoading ? (
        <Card>
          <CardContent className="p-10 text-center">
            <Bell className="mx-auto h-10 w-10 text-[#6E6E70]" />
            <h3 className="mt-3 text-sm font-medium">No notification channels</h3>
            <p className="mt-1 text-sm text-[#989898]">Add email, Slack, or webhook delivery for fired alerts.</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden shadow-none">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-5">Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Destination</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-28 pr-5" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((channel) => (
                <TableRow key={channel.id}>
                  <TableCell className="pl-5 font-medium">{channel.name}</TableCell>
                  <TableCell className="capitalize">{channel.type}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{destination(channel)}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{channel.isActive ? 'active' : 'disabled'}</Badge>
                  </TableCell>
                  <TableCell className="pr-5 text-right">
                    <Button variant="ghost" size="sm" onClick={() => { setEditing(channel); setOpen(true); }}>Edit</Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-[#F2555A] hover:bg-[#F2555A]/10 hover:text-[#F2555A]"
                      aria-label={`Delete ${channel.name}`}
                      disabled={remove.isPending}
                      onClick={() => {
                        if (confirm(`Delete channel ${channel.name}?`)) remove.mutate(channel.id);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
      {open ? (
        <ChannelDialog
          projectId={projectId}
          channel={editing}
          onOpenChange={setOpen}
        />
      ) : null}
    </div>
  );
}

function destination(channel: NotificationChannel) {
  if (channel.type === 'email') return channel.recipientEmails.join(', ') || 'No recipients';
  if (channel.type === 'slack') return channel.slackChannelId || 'No Slack channel';
  return channel.webhookUrl || 'No webhook URL';
}

function ChannelDialog({
  projectId,
  channel,
  onOpenChange,
}: {
  projectId: string;
  channel: NotificationChannel | null;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(channel?.name ?? '');
  const [type, setType] = useState(channel?.type ?? 'email');
  const [recipients, setRecipients] = useState((channel?.recipientEmails ?? []).join(', '));
  const [slackChannelId, setSlackChannelId] = useState(channel?.slackChannelId ?? '');
  const [webhookUrl, setWebhookUrl] = useState(channel?.webhookUrl ?? '');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [isActive, setIsActive] = useState(channel?.isActive ?? true);

  useEffect(() => {
    setName(channel?.name ?? '');
    setType(channel?.type ?? 'email');
    setRecipients((channel?.recipientEmails ?? []).join(', '));
    setSlackChannelId(channel?.slackChannelId ?? '');
    setWebhookUrl(channel?.webhookUrl ?? '');
    setWebhookSecret('');
    setIsActive(channel?.isActive ?? true);
  }, [channel]);

  const save = useMutation({
    mutationFn: async () => {
      const recipientEmails = recipients.split(',').map((email) => email.trim()).filter(Boolean);
      if (type === 'email' && recipientEmails.some((email) => !email.includes('@'))) {
        throw new Error('Please enter valid email addresses');
      }
      const path = channel
        ? `/projects/${projectId}/notifications/channels/${encodeURIComponent(channel.id)}`
        : `/projects/${projectId}/notifications/channels`;
      const body = channel
        ? {
            name: name.trim(),
            isActive,
            recipientEmails: type === 'email' ? recipientEmails : undefined,
            slackChannelId: type === 'slack' ? slackChannelId.trim() || undefined : undefined,
            webhookUrl: type === 'webhook' ? webhookUrl.trim() || undefined : undefined,
            webhookSecret: type === 'webhook' && webhookSecret.trim() ? webhookSecret.trim() : undefined,
          }
        : {
            name: name.trim(),
            type,
            recipientEmails: type === 'email' ? recipientEmails : [],
            slackChannelId: type === 'slack' ? slackChannelId.trim() || undefined : undefined,
            webhookUrl: type === 'webhook' ? webhookUrl.trim() || undefined : undefined,
            webhookSecret: type === 'webhook' && webhookSecret.trim() ? webhookSecret.trim() : undefined,
          };
      return channel ? api.put<NotificationChannel>(path, body) : api.post<NotificationChannel>(path, body);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notification-channels', projectId] });
      onOpenChange(false);
    },
    onError: (error) => {
      console.error('Failed to save channel:', error);
    },
  });

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{channel ? 'Edit channel' : 'Create channel'}</DialogTitle>
          <DialogDescription>Where alert notifications should be delivered.</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            save.mutate();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="channel-name">Name</Label>
            <Input id="channel-name" value={name} onChange={(event) => setName(event.target.value)} required />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={type} onValueChange={setType} disabled={!!channel}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CHANNEL_TYPES.map((item) => (
                    <SelectItem key={item} value={item}>{item}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {channel ? (
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={isActive ? 'active' : 'disabled'} onValueChange={(value) => setIsActive(value === 'active')}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">active</SelectItem>
                    <SelectItem value="disabled">disabled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ) : null}
          </div>
          {type === 'email' ? (
            <div className="space-y-2">
              <Label htmlFor="channel-emails">Recipient emails</Label>
              <Input id="channel-emails" value={recipients} onChange={(event) => setRecipients(event.target.value)} placeholder="sre@example.com, oncall@example.com" required />
              {recipients && recipients.split(',').some((email) => email.trim() && !email.trim().includes('@')) ? (
                <p className="text-xs text-destructive">Please enter valid email addresses</p>
              ) : null}
            </div>
          ) : null}
          {type === 'slack' ? (
            <div className="space-y-2">
              <Label htmlFor="channel-slack">Slack channel ID</Label>
              <Input id="channel-slack" value={slackChannelId} onChange={(event) => setSlackChannelId(event.target.value)} placeholder="C0123456789" required />
            </div>
          ) : null}
          {type === 'webhook' ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="channel-webhook">Webhook URL</Label>
                <Input id="channel-webhook" type="url" value={webhookUrl} onChange={(event) => setWebhookUrl(event.target.value)} placeholder="https://hooks.example.com/alerts" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="channel-secret">Webhook secret {channel ? '(leave blank to keep)' : ''}</Label>
                <Input id="channel-secret" value={webhookSecret} onChange={(event) => setWebhookSecret(event.target.value)} placeholder="HMAC secret" />
              </div>
            </>
          ) : null}
          {save.isError ? <p role="alert" className="text-sm text-destructive">{save.error instanceof Error ? save.error.message : 'Could not save channel'}</p> : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={save.isPending || !name.trim()}>{save.isPending ? 'Saving...' : channel ? 'Update channel' : 'Create channel'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
