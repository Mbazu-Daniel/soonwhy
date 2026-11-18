import { describe, expect, it } from 'vitest';
import { canManageStatusPage, projectSettingsKey, statusPageUrl } from './status-page';

describe('canManageStatusPage', () => {
  it('allows owners and admins, including a combined role', () => {
    expect(canManageStatusPage('owner')).toBe(true);
    expect(canManageStatusPage('admin')).toBe(true);
    expect(canManageStatusPage('member, admin')).toBe(true);
  });

  it('does not allow members or an unknown role', () => {
    expect(canManageStatusPage('member')).toBe(false);
    expect(canManageStatusPage('')).toBe(false);
    expect(canManageStatusPage(undefined)).toBe(false);
  });
});

describe('statusPageUrl', () => {
  it('builds the public address from the organization and project slugs', () => {
    expect(statusPageUrl('https://app.example.com', 'acme', 'web')).toBe('https://app.example.com/public/status/acme/web');
  });

  it('encodes unusual slugs', () => {
    expect(statusPageUrl('https://x.io', 'a b', 'c/d')).toBe('https://x.io/public/status/a%20b/c%2Fd');
  });

  it('is null until both slugs are known', () => {
    expect(statusPageUrl('https://x.io', null, 'web')).toBeNull();
    expect(statusPageUrl('https://x.io', 'acme', null)).toBeNull();
  });
});

describe('projectSettingsKey', () => {
  it('is scoped to the project', () => {
    expect(projectSettingsKey('p1')).toEqual(['project-settings', 'p1']);
  });
});
