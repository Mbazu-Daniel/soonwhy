export function organizationIdFromUrl(url: string): string | undefined {
  const path = url.split('?')[0] ?? url;
  const match = path.match(/\/organization\/([^/]+)/);
  if (!match?.[1]) return undefined;
  return decodeURIComponent(match[1]);
}
