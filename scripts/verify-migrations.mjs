import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const migrationsDir = path.resolve('apps/api/drizzle');
const entries = (await readdir(migrationsDir)).filter((name) => /^\d+_.+\.sql$/.test(name)).sort();
if (entries.length === 0) throw new Error(`No SQL migrations found in ${migrationsDir}`);

const seenVersions = new Set();
const seenDatabaseObjects = new Map();
let previousVersion = -1;

for (const filename of entries) {
  const match = /^(\d+)_/.exec(filename);
  if (!match) throw new Error(`Invalid migration filename: ${filename}`);
  const version = Number(match[1]);
  if (seenVersions.has(version)) throw new Error(`Duplicate migration version ${match[1]}: ${filename}`);
  if (version <= previousVersion) throw new Error(`Migration versions are not strictly increasing at ${filename}`);
  seenVersions.add(version);
  previousVersion = version;

  const sql = await readFile(path.join(migrationsDir, filename), 'utf8');
  const objectPatterns = [
    /CREATE\s+(?:UNIQUE\s+)?INDEX(?:\s+IF\s+NOT\s+EXISTS)?\s+["\`]?([a-zA-Z0-9_]+)["\`]?/gi,
    /ADD\s+CONSTRAINT\s+["\`]?([a-zA-Z0-9_]+)["\`]?/gi,
  ];

  for (const pattern of objectPatterns) {
    for (const objectMatch of sql.matchAll(pattern)) {
      const objectName = objectMatch[1];
      const previous = seenDatabaseObjects.get(objectName);
      if (previous) throw new Error(`Database object ${objectName} is declared in both ${previous} and ${filename}`);
      seenDatabaseObjects.set(objectName, filename);
    }
  }
}
console.log(`Verified ${entries.length} migrations and ${seenDatabaseObjects.size} database objects.`);
