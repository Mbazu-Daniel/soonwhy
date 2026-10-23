import { defineConfig } from 'vite';
import { soonwhyVite } from '@soonwhy/vite';

export default defineConfig({
  plugins: [soonwhyVite({
    apiKey: process.env.VITE_SOONWHY_API_KEY!,
    endpoint: process.env.VITE_SOONWHY_ENDPOINT,
    serviceName: 'example-vite-app',
  })],
});
