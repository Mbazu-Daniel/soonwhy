import { initNode } from '@soonwhy/sdk/node';

const sdk = initNode({
  apiKey: process.env.SOONWHY_API_KEY ?? '',
  endpoint: process.env.SOONWHY_ENDPOINT,
  serviceName: 'soonwhy-example-nestjs',
  environment: '4c-validation',
});

const { Controller, Get, Module } = await import('@nestjs/common');
const { NestFactory } = await import('@nestjs/core');
await import('reflect-metadata');

@Controller()
class ExampleController {
  @Get('/health')
  health() {
    return { ok: true };
  }

  @Get('/failure')
  failure(): never {
    throw new Error('4C NestJS example failure');
  }
}

@Module({ controllers: [ExampleController] })
class ExampleModule {}

const app = await NestFactory.create(ExampleModule);
await app.listen(3001);

const close = async () => {
  await app.close();
  await sdk.shutdown();
};

process.once('SIGINT', () => void close());
process.once('SIGTERM', () => void close());

console.log('NestJS example listening on http://localhost:3001');
