export function quickwitTerm(field: string, value: string): string {
  const escaped = value.replace(/[+\-=&|><!(){}[\]^"~*?:\\/]/g, '\\$&');
  return `${field}:"${escaped}"`;
}

export function quickwitTenantQuery(orgId: string, projectId: string, extra = '*'): string {
  const tenant = `${quickwitTerm('org_id', orgId)} AND ${quickwitTerm('project_id', projectId)}`;
  return extra === '*' ? tenant : `${tenant} AND (${extra})`;
}

export function quickwitTimestamp(value: string): number {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) throw new Error(`Invalid telemetry timestamp: ${value}`);
  return Math.floor(timestamp / 1000);
}
