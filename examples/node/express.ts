import { initNode } from '@soonwhy/sdk/node';
import express from 'express';

const sdk = initNode({
  apiKey: process.env.SOONWHY_API_KEY ?? '',
  endpoint: process.env.SOONWHY_ENDPOINT,
  serviceName: 'soonwhy-example-express',
  environment: '4c-validation',
});

const app = express();

app.get('/slow', async (_request, response) => {
  await new Promise((resolve) => setTimeout(resolve, 250));
  response.json({ ok: true });
});

app.get('/failure', () => {
  throw new Error('4C example failure');
});

const server = app.listen(3000, () => {
  console.log('Express example listening on http://localhost:3000');
});

const close = async () => {
  server.close();
  await sdk.shutdown();
};

process.once('SIGINT', () => void close());
process.once('SIGTERM', () => void close());
