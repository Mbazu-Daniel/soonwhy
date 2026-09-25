import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '~/components/ui/button';
import { Card, CardContent } from '~/components/ui/card';

interface QueryErrorStateProps {
  title?: string;
  message?: string;
  onRetry: () => void;
}

export function QueryErrorState({
  title = 'Unable to load this view',
  message = 'The telemetry request failed. Check your connection and try again.',
  onRetry,
}: QueryErrorStateProps) {
  return (
    <Card role="alert" className="border-[#F8C7C2] bg-white shadow-none">
      <CardContent className="flex flex-col items-center p-10 text-center">
        <span className="grid h-10 w-10 place-items-center rounded-lg bg-[#FDE8E6]">
          <AlertTriangle className="h-5 w-5 text-[#8A1C13]" aria-hidden="true" />
        </span>
        <p className="mt-3 font-medium">{title}</p>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">{message}</p>
        <Button variant="outline" onClick={onRetry} className="mt-4 border-[#CBD8C7]">
          <RefreshCw className="mr-2 h-3.5 w-3.5" />
          Try again
        </Button>
      </CardContent>
    </Card>
  );
}
