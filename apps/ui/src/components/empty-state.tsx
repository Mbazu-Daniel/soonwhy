import { Server } from 'lucide-react';
import { Card, CardContent } from '~/components/ui/card';

export function EmptyProject() {
  return (
    <Card className="rounded-2xl border-dashed border-[#242426] bg-[#0B0B0C]">
      <CardContent className="p-12 text-center">
        <Server className="mx-auto h-6 w-6 text-[#ACFC15]" />
        <p className="mt-3 text-sm font-medium text-[#F6F6F6]">Choose a project</p>
        <p className="mt-1 text-sm text-[#989898]">
          Select a project from the sidebar to start exploring telemetry.
        </p>
      </CardContent>
    </Card>
  );
}
