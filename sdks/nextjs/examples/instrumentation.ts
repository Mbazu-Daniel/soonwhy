import { initNextjs } from '@soonwhy/nextjs';

export function register() {
  initNextjs({
    apiKey: process.env.SOONWHY_API_KEY!,
    serviceName: 'example-nextjs-app',
  });
}
