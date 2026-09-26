import { createRequire } from 'node:module';
import type { ResolvedNodeSdkOptions } from './config.js';

const require = createRequire(import.meta.url);

interface NodeSdkModule {
  NodeSDK: new (configuration: Record<string, unknown>) => {
    start(): void;
    shutdown(): Promise<void>;
  };
}

interface TraceExporterModule {
  OTLPTraceExporter: new (options: {
    url: string;
    headers: Record<string, string>;
    timeoutMillis: number;
  }) => {
    shutdown(): Promise<void>;
  };
}

interface AutoInstrumentationModule {
  getNodeAutoInstrumentations(
    configuration?: Record<string, Record<string, unknown>>,
  ): unknown;
}

interface ResourceModule {
  defaultResource(): { merge(other: unknown): unknown };
  resourceFromAttributes(attributes: Record<string, unknown>): unknown;
}

interface SamplerModule {
  AlwaysOffSampler: new () => unknown;
  AlwaysOnSampler: new () => unknown;
  TraceIdRatioBasedSampler: new (ratio: number) => unknown;
}

export interface OTelRuntime {
  sdk: {
    start(): void;
    shutdown(): Promise<void>;
  };
  exporter: {
    shutdown(): Promise<void>;
  };
}

export function createOpenTelemetryRuntime(options: ResolvedNodeSdkOptions): OTelRuntime {
  const resources = require('@opentelemetry/resources') as ResourceModule;
  const sdkModule = require('@opentelemetry/sdk-node') as NodeSdkModule;
  const exporterModule = require(
    '@opentelemetry/exporter-trace-otlp-proto',
  ) as TraceExporterModule;
  const autoInstrumentationModule = require(
    '@opentelemetry/auto-instrumentations-node',
  ) as AutoInstrumentationModule;

  const resource = resources.defaultResource().merge(
    resources.resourceFromAttributes({
      'service.name': options.serviceName,
      ...(options.serviceVersion ? { 'service.version': options.serviceVersion } : {}),
      ...(options.environment ? { 'deployment.environment.name': options.environment } : {}),
      ...(options.deployment ? { 'deployment.version': options.deployment } : {}),
      ...(options.resourceAttributes ?? {}),
    }),
  );

  const exporter = new exporterModule.OTLPTraceExporter({
    url: `${options.endpoint}/traces`,
    headers: {
      authorization: `Bearer ${options.apiKey}`,
    },
    timeoutMillis: options.timeoutMs,
  });

  const instrumentations = autoInstrumentationModule.getNodeAutoInstrumentations(
    buildInstrumentationConfig(options.instrumentations),
  );

  const sdk = new sdkModule.NodeSDK({
    resource,
    traceExporter: exporter,
    instrumentations,
    sampler: createSampler(options),
  });

  return { sdk, exporter };
}

export function buildInstrumentationConfig(
  requested: ResolvedNodeSdkOptions['instrumentations'],
): Record<string, Record<string, unknown>> {
  const config: Record<string, Record<string, unknown>> = {
    '@opentelemetry/instrumentation-http': { enabled: requested.http },
    '@opentelemetry/instrumentation-express': { enabled: requested.express },
    '@opentelemetry/instrumentation-nestjs-core': { enabled: requested.nestjs },
    '@opentelemetry/instrumentation-pg': {
      enabled: requested.postgres,
      enhancedDatabaseReporting: false,
    },
    '@opentelemetry/instrumentation-redis': {
      enabled: requested.redis,
      dbStatementSerializer: (command: string) => command,
    },
    '@opentelemetry/instrumentation-ioredis': {
      enabled: requested.ioredis,
      dbStatementSerializer: (command: string) => command,
    },
    '@opentelemetry/instrumentation-undici': { enabled: requested.http },
  };

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
    'winston',
  ]) {
    config[`@opentelemetry/instrumentation-${name}`] = { enabled: false };
  }

  return config;
}

function createSampler(options: ResolvedNodeSdkOptions): unknown {
  const samplers = require('@opentelemetry/sdk-trace-base') as SamplerModule;

  switch (options.sampling.type) {
    case 'always_off':
      return new samplers.AlwaysOffSampler();
    case 'ratio':
      return new samplers.TraceIdRatioBasedSampler(options.sampling.ratio);
    case 'always_on':
      return new samplers.AlwaysOnSampler();
  }
}

export function supportedInstrumentations(): readonly string[] {
  return ['http', 'express', 'nestjs', 'postgres', 'redis', 'ioredis'];
}
