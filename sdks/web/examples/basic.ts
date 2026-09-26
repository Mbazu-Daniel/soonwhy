import { SoonwhyWeb } from '@soonwhy/web';

const soonwhy = new SoonwhyWeb({
  apiKey: import.meta.env.VITE_SOONWHY_API_KEY,
  endpoint: import.meta.env.VITE_SOONWHY_ENDPOINT,
  serviceName: 'example-web-app',
});

soonwhy.captureLog('Web SDK example started');
window.addEventListener('error', event => {
  soonwhy.captureError(event.error ?? new Error(event.message));
});
