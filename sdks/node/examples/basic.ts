import { initNode } from '@soonwhy/node';

const sdk = initNode({
  apiKey: process.env.SOONWHY_API_KEY!,
  serviceName: 'example-node-service',
});

console.log('Soonwhy Node SDK initialized');

process.on('SIGTERM', async () => {
  await sdk.shutdown();
  process.exit(0);
});
