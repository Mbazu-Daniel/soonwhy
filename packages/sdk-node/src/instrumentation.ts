import { defaultResource, resourceFromAttributes } from '@opentelemetry/resources';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';
import {
  AlwaysOffSampler,
  AlwaysOnSampler,
  TraceIdRatioBasedSampler,
} from '@opentelemetry/sdk-trace-base';
import type { ResolvedNodeSdkOptions } from './config.js';

const ENABLED = new Set(['http', 'express', 'nestjs-core', 'pg', 'redis', 'ioredis']);

export interface OTelRuntime {
  sdk: NodeSDK;
  exporter: OTLPTraceExporter;
}

export function createOpenTelemetryRuntime(options: ResolvedNodeSdkOptions): OTelRuntime {
  const resource = defaultResource().merge(
    resourceFromAttributes({
      'service.name': options.serviceName,
      ...(options.serviceVersion ? { 'service.version': options.serviceVersion } : {}),
      ...(options.environment ? { 'deployment.environment.name': options.environment } : {}),
      ...(options.deployment ? { 'deployment.version': options.deployment } : {}),
      ...(options.resourceAttributes ?? {}),
    }),
  );

  const exporter = new OTLPTraceExporter({
    url: `${options.endpoint}/traces`,
    headers: {
      authorization: `Bearer ${options.apiKey}`,
    },
    timeoutMillis: options.timeoutMs,
  });

  const instrumentations = getNodeAutoInstrumentations(
    buildInstrumentationConfig(options.instrumentations),
  );

  const sdk = new NodeSDK({
    resource,
    traceExporter: exporter,
    instrumentations: [instrumentations],
    sampler: createSampler(options),
  });

  return { sdk, exporter };
}

function buildInstrumentationConfig(
  requested: ResolvedNodeSdkOptions['instrumentations'],
): Record<string, Record<string, unknown>> {
  const config: Record<string, Record<string, unknown>> = {};

  for (const name of [
    'http',
    'express',
    'nestjs-core',
    'pg',
    'redis',
    'ioredis',
  ]) {
    config[`@opentelemetry/instrumentation-${name}`] = {
      enabled: requested[name === 'nestjs-core' ? 'nestjs' : name as keyof typeof requested],
    };
  }

  for (const name of [
    'amqplib',
    'aws-lambda',
    'aws-sdk',
    'bunyan',
    'cassandra-driver',
    'connect',
    'cucumber',
    'dataloader',
    'dns',
    'fs',
    'generic-pool',
    'graphql',
    'grpc',
    'hapi',
    'kafkajs',
    'knex',
    'koa',
    'lru-memoizer',
    'memcached',
    'mongodb',
    'mongoose',
    'mysql',
    'mysql2',
    'net',
    'pino',
    'restify',
    'runtime-node',
    'socket.io',
    'undici',
    'winston',
  ]) {
    config[`@opentelemetry/instrumentation-${name}`] = { enabled: false };
  }

  return config;
}

function createSampler(options: ResolvedNodeSdkOptions): unknown {
  switch (options.sampling.type) {
    case 'always_off':
      return new AlwaysOffSampler();
    case 'ratio':
      return new TraceIdRatioBasedSampler(options.sampling.ratio);
    case 'always_on':
      return new AlwaysOnSampler();
  }
}

export function hasSupportedInstrumentation(name: string): boolean {
  return ENABLED.has(name);
}
