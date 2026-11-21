import { describe, expect, it } from 'vitest';
import { packagesFromLockfile } from './lockfile';

describe('packagesFromLockfile', () => {
  it('reads npm v2 and v3 lockfiles, keeps nested copies and scoped names, skips dev and links', () => {
    const lock = {
      packages: {
        '': { version: '1.0.0' },
        'node_modules/lodash': { version: '4.17.20' },
        'node_modules/@nestjs/core': { version: '11.0.0' },
        'node_modules/a/node_modules/lodash': { version: '3.0.0' },
        'node_modules/jest': { version: '29.0.0', dev: true },
        'node_modules/local': { link: true },
      },
    };
    expect(packagesFromLockfile(JSON.stringify(lock))).toEqual(['@nestjs/core@11.0.0', 'lodash@3.0.0', 'lodash@4.17.20']);
  });

  it('reads the older nested dependencies format', () => {
    const lock = { dependencies: { a: { version: '1.0.0', dependencies: { b: { version: '2.0.0' } } }, c: { version: '3.0.0', dev: true } } };
    expect(packagesFromLockfile(JSON.stringify(lock))).toEqual(['a@1.0.0', 'b@2.0.0']);
  });

  it('returns nothing for a file that is not a lockfile', () => {
    expect(packagesFromLockfile('{}')).toEqual([]);
  });
});
