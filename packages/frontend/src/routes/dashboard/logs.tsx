import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Input } from '~/components/ui/input';
import { Button } from '~/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import { Search } from 'lucide-react';

export const Route = createFileRoute('/dashboard/logs')({
  component: LogViewer,
});

function LogViewer() {
  const [search, setSearch] = useState('');
  const [levelFilter, setLevelFilter] = useState('all');
  const [serviceFilter, setServiceFilter] = useState('all');

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Logs</h2>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search logs..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={levelFilter} onValueChange={setLevelFilter}>
              <SelectTrigger className="w-32"><SelectValue placeholder="Level" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Levels</SelectItem>
                <SelectItem value="error">Error</SelectItem>
                <SelectItem value="warn">Warn</SelectItem>
                <SelectItem value="info">Info</SelectItem>
                <SelectItem value="debug">Debug</SelectItem>
              </SelectContent>
            </Select>
            <Select value={serviceFilter} onValueChange={setServiceFilter}>
              <SelectTrigger className="w-44"><SelectValue placeholder="Service" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Services</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setSearch(''); setLevelFilter('all'); setServiceFilter('all'); }}
            >
              Reset
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground">0 log entries</CardTitle>
        </CardHeader>
        <CardContent className="p-8 text-center text-muted-foreground text-sm">
          No logs found
        </CardContent>
      </Card>
    </div>
  );
}
