import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const args = process.argv.slice(2);
const packageIndex = args.indexOf('--package');
const packageName = packageIndex >= 0 ? args[packageIndex + 1] : 'soonwhy-snapshot-timestamp';

if (!packageName) {
  throw new Error('Usage: pnpm publish:local --package <package-name>');
}

const packageJsonPath = resolve(root, 'packages', packageName.replace(/^@[^/]+\//, '').replace(/^soonwhy-/, packageName.startsWith('@') ? '' : 'soonwhy-'), 'package.json');

let packageDir = resolve(root, 'packages', packageName);
try {
  packageDir = resolve(root, 'packages', packageName);
  readFileSync(resolve(packageDir, 'package.json'));
} catch {
  throw new Error(`Local workspace package not found: ${packageName}`);
}

const manifestPath = resolve(packageDir, 'package.json');
const original = readFileSync(manifestPath, 'utf8');
const manifest = JSON.parse(original);
const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
manifest.version = `0.0.0-snapshot.${timestamp}`;
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

try {
  execFileSync('pnpm', ['--filter', manifest.name, 'build'], { cwd: root, stdio: 'inherit' });
  execFileSync('pnpm', ['--filter', manifest.name, 'publish', '--no-git-checks', '--tag', 'snapshot'], {
    cwd: root,
    stdio: 'inherit',
  });
} finally {
  writeFileSync(manifestPath, original);
}
