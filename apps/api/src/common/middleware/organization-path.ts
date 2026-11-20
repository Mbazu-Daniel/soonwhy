export function organizationIdFromUrl(url: string): string | undefined {
  const path = url.split("?")[0] ?? url;
  const match = path.match(/\/organization\/([^/]+)/);
  if (!match?.[1]) return undefined;
  return decodeURIComponent(match[1]);
}

export function projectIdFromUrl(url: string): string | undefined {
  const [path, query = ""] = url.split("?");
  const fromPath = (path ?? "").match(/\/projects\/([^/]+)/)?.[1];
  const fromQuery = new URLSearchParams(query).get("projectId");
  const value = fromPath ?? fromQuery;
  return value ? decodeURIComponent(value) : undefined;
}
