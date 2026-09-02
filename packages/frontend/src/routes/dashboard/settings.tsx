import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Separator } from '~/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs';
import { Badge } from '~/components/ui/badge';
import { Copy, Trash2, Plus } from 'lucide-react';
import { ApiKeyDisplay } from '~/components/create-project-dialog';

export const Route = createFileRoute('/dashboard/settings')({
  component: SettingsPage,
});

function GeneralSettings() {
  const [projectName, setProjectName] = useState('My Project');
  const [saved, setSaved] = useState(false);

  function handleSave() {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>General</CardTitle>
        <CardDescription>Project name and general settings</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="project-name">Project Name</Label>
          <Input
            id="project-name"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>Project ID</Label>
          <div className="flex items-center gap-2">
            <code className="px-2 py-1 bg-muted rounded text-sm font-mono">proj_abc123def456</code>
            <Button variant="ghost" size="sm">
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="space-y-2">
          <Label>Region</Label>
          <p className="text-sm text-muted-foreground">US East (Virginia)</p>
        </div>
        <div className="flex justify-end">
          <Button onClick={handleSave}>
            {saved ? 'Saved!' : 'Save Changes'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ApiKeySettings() {
  const [keys, setKeys] = useState([
    { id: '1', name: 'Production', prefix: 'sw_prod_', createdAt: '2026-08-15', lastUsed: '2026-09-02' },
    { id: '2', name: 'Staging', prefix: 'sw_stg_', createdAt: '2026-08-20', lastUsed: '2026-09-01' },
  ]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>API Keys</CardTitle>
          <CardDescription>Manage API keys for SDK authentication</CardDescription>
        </div>
        <Button size="sm">
          <Plus className="h-4 w-4 mr-1" />
          Create Key
        </Button>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {keys.map((key) => (
            <div key={key.id} className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <p className="font-medium text-sm">{key.name}</p>
                <p className="text-xs text-muted-foreground">
                  <code>{key.prefix}{'*'.repeat(24)}</code>
                </p>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right text-xs text-muted-foreground">
                  <p>Created: {key.createdAt}</p>
                  <p>Last used: {key.lastUsed}</p>
                </div>
                <Button variant="ghost" size="sm">
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function TeamSettings() {
  const members = [
    { id: '1', name: 'You', email: 'you@example.com', role: 'owner' as const },
    { id: '2', name: 'Alice', email: 'alice@example.com', role: 'admin' as const },
    { id: '3', name: 'Bob', email: 'bob@example.com', role: 'member' as const },
  ];

  const roleColors = {
    owner: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
    admin: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    member: 'bg-muted text-muted-foreground border-border',
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Team</CardTitle>
          <CardDescription>Manage team members and roles</CardDescription>
        </div>
        <Button size="sm" variant="outline">
          Invite Member
        </Button>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {members.map((member) => (
            <div key={member.id} className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-sm font-medium">
                  {member.name[0]}
                </div>
                <div>
                  <p className="text-sm font-medium">{member.name}</p>
                  <p className="text-xs text-muted-foreground">{member.email}</p>
                </div>
              </div>
              <Badge variant="outline" className={roleColors[member.role]}>
                {member.role}
              </Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function BillingSettings() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Billing</CardTitle>
        <CardDescription>Manage your subscription and usage</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="p-4 border rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="font-medium">Growth Plan</p>
              <p className="text-sm text-muted-foreground">$49/month</p>
            </div>
            <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">
              Active
            </Badge>
          </div>
          <Separator className="my-3" />
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Ingested this month</p>
              <p className="font-medium">32.4 GB / 75 GB</p>
            </div>
            <div>
              <p className="text-muted-foreground">Overage charges</p>
              <p className="font-medium">$0.00</p>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <Button variant="outline">Change Plan</Button>
          <Button variant="outline" className="text-destructive hover:text-destructive">
            Cancel Subscription
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Settings</h2>
        <p className="text-muted-foreground">Manage your project settings</p>
      </div>

      <Tabs defaultValue="general" className="space-y-6">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="api-keys">API Keys</TabsTrigger>
          <TabsTrigger value="team">Team</TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <GeneralSettings />
        </TabsContent>
        <TabsContent value="api-keys">
          <ApiKeySettings />
        </TabsContent>
        <TabsContent value="team">
          <TeamSettings />
        </TabsContent>
        <TabsContent value="billing">
          <BillingSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
}
