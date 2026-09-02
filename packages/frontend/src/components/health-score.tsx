import { cn } from '~/lib/utils';

interface HealthScoreProps {
  score: number;
  className?: string;
}

export function HealthScore({ score, className }: HealthScoreProps) {
  const color =
    score >= 80
      ? { text: 'text-green-500', ring: 'stroke-green-500' }
      : score > 0
      ? { text: 'text-yellow-500', ring: 'stroke-yellow-500' }
      : { text: 'text-muted-foreground', ring: 'stroke-muted' };

  const circumference = 2 * Math.PI * 40;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className={cn('relative h-24 w-24', className)}>
      <svg className="h-24 w-24 -rotate-90" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" strokeWidth="8" className="text-muted" />
        <circle
          cx="50" cy="50" r="40" fill="none" strokeWidth="8"
          strokeDasharray={circumference} strokeDashoffset={offset}
          className={color.ring} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.5s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={cn('text-2xl font-bold', color.text)}>{score || '—'}</span>
      </div>
    </div>
  );
}
