import type { SoonwhyClient } from '../client';

export function instrumentHttp(client: SoonwhyClient) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const http = require('http');
  const https = require('https');
  const origHttp = http.request;
  const origHttps = https.request;

  const wrap = (orig: (...args: any[]) => any) =>
    function (this: unknown, ...args: any[]) {
      const start = Date.now();
      const req = orig.apply(this, args);
      const origEnd = req.end;
      req.end = function (this: unknown, ...endArgs: any[]) {
        client.captureRequest({
          method: args[0]?.method || 'GET',
          url: typeof args[0] === 'string' ? args[0] : args[0]?.pathname || '',
          statusCode: req.statusCode || 0,
          duration: Date.now() - start,
        });
        return origEnd.apply(this, endArgs);
      };
      return req;
    };

  http.request = wrap(origHttp);
  https.request = wrap(origHttps);
}

export function autoInstrumentHttp(client: SoonwhyClient) {
  instrumentHttp(client);
}
