import { describe, expect, it } from 'vitest';
import { detectDatabaseConnectionPool, type DatabaseConnectionPoolSample } from './database-connection-pool.detector';

const sample = (index: number, overrides: Partial<DatabaseConnectionPoolSample> = {}): DatabaseConnectionPoolSample => ({
  timestamp: new Date(Date.parse('2026-09-28T10:00:00.000Z') + index * 60_000).toISOString(),
  service: 'api',
  poolName: 'primary',
  usedConnections: 9,
  maxConnections: 10,
  pendingRequests: 2,
  ...overrides,
});

describe('database connection pool detector', () => {
  it('detects sustained pool pressure', () => {
    const result = detectDatabaseConnectionPool(Array.from({ length: 6 }, (_, index) => sample(index)));
    expect(result).toHaveLength(1);
    expect(result[0]?.signal.p95UtilizationPercent).toBe(90);
    expect(result[0]?.signal.p95PendingRequests).toBe(2);
  });

  it('detects connection timeout growth', () => {
    const result = detectDatabaseConnectionPool(
      Array.from({ length: 6 }, (_, index) => sample(index, {
        usedConnections: undefined,
        maxConnections: undefined,
        pendingRequests: undefined,
        connectionTimeouts: index,
      })),
    );
    expect(result[0]?.signal.timeoutIncrease).toBe(5);
  });

  it('ignores healthy pools', () => {
    expect(detectDatabaseConnectionPool(
      Array.from({ length: 6 }, (_, index) => sample(index, {
        usedConnections: 3,
        maxConnections: 10,
        pendingRequests: 0,
        connectionTimeouts: 0,
      })),
    )).toEqual([]);
  });

  it('isolates services and pools', () => {
    const samples = Array.from({ length: 6 }, (_, index) => sample(index));
    const other = Array.from({ length: 6 }, (_, index) => sample(index, {
      service: 'worker',
      poolName: 'analytics',
      usedConnections: 2,
      maxConnections: 10,
      pendingRequests: 0,
    }));
    expect(detectDatabaseConnectionPool([...samples, ...other])).toHaveLength(1);
  });

  it('requires enough observations', () => {
    expect(detectDatabaseConnectionPool(Array.from({ length: 4 }, (_, index) => sample(index)))).toEqual([]);
  });
});
