interface LockEntry {
  version?: string;
  dev?: boolean;
  link?: boolean;
  dependencies?: Record<string, LockEntry>;
}

interface Lockfile {
  packages?: Record<string, LockEntry>;
  dependencies?: Record<string, LockEntry>;
}

const MODULES_SEGMENT = 'node_modules/';

function collectNested(entries: Record<string, LockEntry>, into: Set<string>) {
  for (const [name, entry] of Object.entries(entries)) {
    if (entry.version && !entry.dev && !entry.link) into.add(`${name}@${entry.version}`);
    if (entry.dependencies) collectNested(entry.dependencies, into);
  }
}

export function packagesFromLockfile(text: string): string[] {
  const lock = JSON.parse(text) as Lockfile;
  const found = new Set<string>();
  if (lock.packages) {
    for (const [path, entry] of Object.entries(lock.packages)) {
      const at = path.lastIndexOf(MODULES_SEGMENT);
      if (at === -1 || !entry.version || entry.dev || entry.link) continue;
      found.add(`${path.slice(at + MODULES_SEGMENT.length)}@${entry.version}`);
    }
  } else if (lock.dependencies) {
    collectNested(lock.dependencies, found);
  }
  return [...found].sort();
}
