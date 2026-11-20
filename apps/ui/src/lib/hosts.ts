export interface Host {
  id: string;
  hostName: string;
  projectId: string;
  firstSeenAt: string;
  lastSeenAt: string;
}

export type HostStatus = 'reporting' | 'quiet';

const HOST_QUIET_AFTER_MS = 5 * 60 * 1000;

export function hostStatus(host: Pick<Host, 'lastSeenAt'>, now: number = Date.now()): HostStatus {
  const seen = Date.parse(host.lastSeenAt);
  return Number.isFinite(seen) && now - seen <= HOST_QUIET_AFTER_MS ? 'reporting' : 'quiet';
}
