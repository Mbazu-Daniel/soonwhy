import type { SoonwhyClient } from '../client';

export function instrumentPg(client: SoonwhyClient) {
  try {
    const { Pool } = require('pg');

    const originalQuery = Pool.prototype.query;

    Pool.prototype.query = function instrumentedQuery(...args: any[]) {
      const startTime = Date.now();
      const query = typeof args[0] === 'string' ? args[0] : args[0]?.text || '';

      return originalQuery.apply(this, args).then((result: any) => {
        const duration = Date.now() - startTime;
        client.captureMetric({
          name: 'db.query.duration',
          value: duration,
          unit: 'ms',
        });
        return result;
      }).catch((error: any) => {
        const duration = Date.now() - startTime;
        client.captureMetric({
          name: 'db.query.duration',
          value: duration,
          unit: 'ms',
        });
        throw error;
      });
    };
  } catch {
    // pg not available
  }
}

export function instrumentDrizzle(client: SoonwhyClient) {
  try {
    // Drizzle uses pg under the hood, so pg instrumentation covers it
    // This is a placeholder for future Drizzle-specific instrumentation
  } catch {
    // drizzle not available
  }
}

export function autoInstrumentDb(client: SoonwhyClient) {
  instrumentPg(client);
  instrumentDrizzle(client);
}
