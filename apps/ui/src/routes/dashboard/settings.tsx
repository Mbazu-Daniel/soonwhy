import { createFileRoute } from '@tanstack/react-router';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Separator } from '~/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs';

export const Route = createFileRoute('/dashboard/settings')({
  component: SettingsPage,
});

function GeneralSettings() {
  return (
    <Card>
      <CardHeader><CardTitle>General</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="project-name">Project Name</Label>
          <Input id="project-name" disabled placeholder="—" />
        </div>
        <div className="space-y-2">
          <Label>Project ID</Label>
          <code className="px-2 py-1 bg-muted rounded text-sm font-mono block">—</code>
        </div>
      </CardContent>
    </Card>
  );
}

function ApiKeySettings() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div><CardTitle>API Keys</CardTitle></div>
        <Button size="sm" disabled>Create Key</Button>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground text-center py-8">No API keys</p>
      </CardContent>
    </Card>
  );
}

function TeamSettings() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div><CardTitle>Team</CardTitle></div>
        <Button size="sm" variant="outline" disabled>Invite Member</Button>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground text-center py-8">No team members</p>
      </CardContent>
    </Card>
  );
}

function BillingSettings() {
  return (
    <Card>
      <CardHeader><CardTitle>Billing</CardTitle></CardHeader>
      <CardContent className="space-y-6">
        <div className="p-4 border rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="font-medium">Plan</p>
              <p className="text-sm text-muted-foreground">—</p>
            </div>
          </div>
          <Separator className="my-3" />
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Ingested this month</p>
              <p className="font-medium">—</p>
            </div>
            <div>
              <p className="text-muted-foreground">Overage charges</p>
              <p className="font-medium">—</p>
            </div>
          </div>
        </div>
        <Button variant="outline" disabled>Change Plan</Button>
      </CardContent>
    </Card>
  );
}

function SettingsPage() {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Settings</h2>
      <Tabs defaultValue="general" className="space-y-6">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="api-keys">API Keys</TabsTrigger>
          <TabsTrigger value="team">Team</TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
        </TabsList>
        <TabsContent value="general"><GeneralSettings /></TabsContent>
        <TabsContent value="api-keys"><ApiKeySettings /></TabsContent>
        <TabsContent value="team"><TeamSettings /></TabsContent>
        <TabsContent value="billing"><BillingSettings /></TabsContent>
      </Tabs>
    </div>
  );
}
