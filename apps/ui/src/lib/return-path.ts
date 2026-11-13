const RETURN_PATH_KEY = 'soonwhy:return-path';

export function setReturnPath(path: string) {
  try {
    localStorage.setItem(RETURN_PATH_KEY, path);
  } catch {
    // private browsing etc. — return paths are best effort
  }
}

export function consumeReturnPath(): string | null {
  try {
    const value = localStorage.getItem(RETURN_PATH_KEY);
    if (value) localStorage.removeItem(RETURN_PATH_KEY);
    if (!value || !value.startsWith('/') || value.startsWith('//')) return null;
    return value;
  } catch {
    return null;
  }
}
