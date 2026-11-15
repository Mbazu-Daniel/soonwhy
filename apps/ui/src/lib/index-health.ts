export type IndexStatus = 'healthy' | 'stale' | 'empty' | 'unavailable';

export interface IndexHealth {
  indexId: string;
  status: IndexStatus;
  documents: number;
  sizeBytes: number;
  uncompressedBytes: number;
  oldestEventAt: string | null;
  newestEventAt: string | null;
  splits: {
    published: number;
    staged: number;
    markedForDeletion: number;
    immature: number;
    lastPublishedAt: string | null;
    truncated: boolean;
  };
  error?: string;
}

export interface IndexHealthSnapshot {
  indexes: IndexHealth[];
  staleAfterMinutes: number;
  checkedAt: string;
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** index;
  return `${index === 0 ? value : value.toFixed(value >= 10 ? 0 : 1)} ${units[index]}`;
}

export function formatAge(iso: string | null, now: Date = new Date()): string {
  if (!iso) return 'never';
  const seconds = Math.max(0, Math.round((now.getTime() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export const INDEX_STATUS_LABEL: Record<IndexStatus, string> = {
  healthy: 'Healthy',
  stale: 'No recent events',
  empty: 'Empty',
  unavailable: 'Unavailable',
};
