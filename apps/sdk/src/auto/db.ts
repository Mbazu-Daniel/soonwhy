import type { SoonwhyClient } from '../client';

export function instrumentPg(client: SoonwhyClient) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Pool } = require('pg');
    const orig = Pool.prototype.query;
    Pool.prototype.query = function (this: unknown, ...args: any[]) {
      const start = Date.now();
      return orig.apply(this, args).finally(() => {
        client.captureMetric({ name: 'db.query.duration', value: Date.now() - start, unit: 'ms' });
      });
    };
  } catch {}
}

export function autoInstrumentDb(client: SoonwhyClient) {
  instrumentPg(client);
}
