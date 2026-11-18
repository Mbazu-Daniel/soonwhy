import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { consumeReturnPath, setReturnPath } from './return-path';

let store: Map<string, string>;

beforeEach(() => {
  store = new Map();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
  });
});

afterEach(() => vi.unstubAllGlobals());

describe('return path', () => {
  it('gives back a saved in-app path once', () => {
    setReturnPath('/acme/errors?range=1h');
    expect(consumeReturnPath()).toBe('/acme/errors?range=1h');
    expect(consumeReturnPath()).toBeNull();
  });

  it('never returns an address that leaves the app', () => {
    for (const bad of ['https://evil.example/', '//evil.example/x', 'javascript:alert(1)', 'acme/errors']) {
      setReturnPath(bad);
      expect(consumeReturnPath()).toBeNull();
    }
  });

  it('is null when nothing was saved', () => {
    expect(consumeReturnPath()).toBeNull();
  });

  it('survives storage being unavailable', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
      removeItem: () => {
        throw new Error('blocked');
      },
    });
    expect(() => setReturnPath('/x')).not.toThrow();
    expect(consumeReturnPath()).toBeNull();
  });
});
