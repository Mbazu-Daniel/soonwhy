import express from 'express';
import { initExpress } from '@soonwhy/express';

initExpress({
  apiKey: process.env.SOONWHY_API_KEY!,
  serviceName: 'example-express-service',
});

const app = express();
app.get('/health', (_req, res) => res.json({ ok: true }));
app.listen(3000, () => console.log('Example Express server on :3000'));
