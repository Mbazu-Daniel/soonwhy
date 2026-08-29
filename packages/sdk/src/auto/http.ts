import type { SoonwhyClient } from '../client';

export function instrumentHttp(client: SoonwhyClient) {
  const http = require('http');
  const https = require('https');

  const originalHttpRequest = http.request;
  const originalHttpsRequest = https.request;

  http.request = function instrumentedRequest(...args: any[]) {
    const startTime = Date.now();
    const req = originalHttpRequest.apply(this, args);

    const originalEnd = req.end;
    req.end = function (...endArgs: any[]) {
      const duration = Date.now() - startTime;
      const url = typeof args[0] === 'string' ? args[0] : args[0]?.pathname || '';
      const method = args[0]?.method || 'GET';

      client.captureRequest({
        method,
        url,
        statusCode: req.statusCode || 0,
        duration,
      });

      return originalEnd.apply(this, endArgs);
    };

    return req;
  };

  https.request = function instrumentedRequest(...args: any[]) {
    const startTime = Date.now();
    const req = originalHttpsRequest.apply(this, args);

    const originalEnd = req.end;
    req.end = function (...endArgs: any[]) {
      const duration = Date.now() - startTime;
      const url = typeof args[0] === 'string' ? args[0] : args[0]?.pathname || '';
      const method = args[0]?.method || 'GET';

      client.captureRequest({
        method,
        url,
        statusCode: req.statusCode || 0,
        duration,
      });

      return originalEnd.apply(this, endArgs);
    };

    return req;
  };
}

export function instrumentUndici(client: SoonwhyClient) {
  try {
    const undici = require('undici');
    const originalFetch = globalThis.fetch;

    globalThis.fetch = async function instrumentedFetch(...args: any[]) {
      const startTime = Date.now();
      const url = typeof args[0] === 'string' ? args[0] : args[0]?.url || '';
      const method = args[1]?.method || 'GET';

      try {
        const response = await originalFetch(...(args as Parameters<typeof fetch>));
        const duration = Date.now() - startTime;

        client.captureRequest({
          method,
          url,
          statusCode: response.status,
          duration,
        });

        return response;
      } catch (error) {
        const duration = Date.now() - startTime;
        client.captureRequest({
          method,
          url,
          statusCode: 0,
          duration,
        });
        throw error;
      }
    };
  } catch {
    // undici not available, skip
  }
}

export function instrumentAxios(client: SoonwhyClient) {
  try {
    const axios = require('axios');

    axios.interceptors.request.use((config: any) => {
      config.metadata = { startTime: Date.now() };
      return config;
    });

    axios.interceptors.response.use(
      (response: any) => {
        const duration = Date.now() - (response.config?.metadata?.startTime || Date.now());
        client.captureRequest({
          method: response.config?.method?.toUpperCase() || 'GET',
          url: response.config?.url || '',
          statusCode: response.status,
          duration,
        });
        return response;
      },
      (error: any) => {
        const duration = Date.now() - (error.config?.metadata?.startTime || Date.now());
        client.captureRequest({
          method: error.config?.method?.toUpperCase() || 'GET',
          url: error.config?.url || '',
          statusCode: error.response?.status || 0,
          duration,
        });
        throw error;
      },
    );
  } catch {
    // axios not available, skip
  }
}

export function autoInstrumentHttp(client: SoonwhyClient) {
  instrumentHttp(client);
  instrumentUndici(client);
  instrumentAxios(client);
}
