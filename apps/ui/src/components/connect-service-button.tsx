import type { ReactNode } from 'react';
import { ArrowRight } from 'lucide-react';
import { Button } from '~/components/ui/button';
import { useConnectService } from '~/lib/connect-service';
import { cn } from '~/lib/utils';

export function ConnectServiceButton({
  className,
  children,
  appearance = 'link',
}: {
  className?: string;
  children?: ReactNode;
  appearance?: 'link' | 'secondary';
}) {
  const { open } = useConnectService();

  if (appearance === 'secondary') {
    return (
      <Button type="button" variant="secondary" size="sm" aria-haspopup="dialog" onClick={open} className={className}>
        {children ?? <>Connect a service <ArrowRight aria-hidden="true" /></>}
      </Button>
    );
  }

  return (
    <button
      type="button"
      onClick={open}
      aria-haspopup="dialog"
      className={cn('inline-flex cursor-pointer items-center gap-1.5 text-sm font-medium text-[#16931F] hover:underline', className)}
    >
      {children ?? 'Open setup flow'}
    </button>
  );
}
