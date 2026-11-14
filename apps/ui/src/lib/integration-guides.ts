export const DEFAULT_INGEST_URL = 'https://ingest-soonwhy.oktopals.com';

export const FRAMEWORKS = [
  {
    id: 'node',
    label: 'Node.js',
    fileName: 'instrumentation.ts',
    install: 'pnpm add @soonwhy/node',
    code: (key?: string) => `import { initNode } from '@soonwhy/node';

const sdk = initNode({
  apiKey: process.env.SOONWHY_API_KEY ?? '${key ?? 'YOUR_PROJECT_API_KEY'}',
  endpoint: process.env.SOONWHY_ENDPOINT,
  serviceName: 'my-service',
  environment: 'production',
});`,
    note: 'Start instrumentation before importing your application. The first telemetry appears once real traffic flows.',
  },
  {
    id: 'bun',
    label: 'Bun',
    fileName: 'instrumentation.ts',
    install: 'bun add @soonwhy/node',
    code: (key?: string) => `import { initNode } from '@soonwhy/node';

const sdk = initNode({
  apiKey: process.env.SOONWHY_API_KEY ?? '${key ?? 'YOUR_PROJECT_API_KEY'}',
  endpoint: process.env.SOONWHY_ENDPOINT,
  serviceName: 'my-service',
  environment: 'production',
});`,
    note: 'Start instrumentation before importing your application. The first telemetry appears once real traffic flows.',
  },
  {
    id: 'nestjs',
    label: 'NestJS',
    fileName: 'app.module.ts',
    install: 'pnpm add @soonwhy/nest',
    code: (key?: string) => `import { Module } from '@nestjs/common';
import { SoonwhyModule } from '@soonwhy/nest';
import { AppController } from './app.controller';

@Module({
  imports: [
    SoonwhyModule.forRoot({
      apiKey: process.env.SOONWHY_API_KEY ?? '${key ?? 'YOUR_PROJECT_API_KEY'}',
      endpoint: process.env.SOONWHY_ENDPOINT,
      serviceName: 'my-service',
      environment: 'production',
    }),
  ],
  controllers: [AppController],
})
export class AppModule {}`,
    note: "The SDK flushes telemetry on SIGINT/SIGTERM by default. To let Nest own shutdown instead, set registerShutdownHandlers: false and call app.enableShutdownHooks() in main.ts.",
  },
  {
    id: 'nextjs',
    label: 'Next.js',
    fileName: 'instrumentation.ts',
    install: 'pnpm add @soonwhy/next',
    code: (key?: string) => `import { createSoonwhyInstrumentation } from '@soonwhy/next';

export const { register, onRequestError } = createSoonwhyInstrumentation({
  apiKey: process.env.SOONWHY_API_KEY ?? '${key ?? 'YOUR_PROJECT_API_KEY'}',
  endpoint: process.env.SOONWHY_ENDPOINT,
  serviceName: 'my-service',
  environment: 'production',
});`,
    note: "Wrap App Router route handlers with withSoonwhy() from @soonwhy/next for route-aware span names; onRequestError reports server errors automatically.",
  },
  {
    id: 'vite',
    label: 'Vite',
    fileName: 'vite.config.ts',
    install: 'pnpm add @soonwhy/vite',
    code: (key?: string) => `import { defineConfig } from 'vite';
import soonwhy from '@soonwhy/vite';

export default defineConfig({
  plugins: [
    soonwhy({
      apiKey: process.env.SOONWHY_API_KEY ?? '${key ?? 'YOUR_PROJECT_API_KEY'}',
      endpoint: process.env.SOONWHY_ENDPOINT,
      serviceName: 'my-service',
      environment: 'production',
    }),
  ],
});`,
    note: 'Applies to the dev server only. Production servers initialize the SDK in their own server entry instead.',
  },
  {
    id: 'otel-collector',
    label: 'OpenTelemetry Collector',
    fileName: 'otelcol.yaml',
    install: 'docker run --rm -v "$PWD/otelcol.yaml:/etc/otelcol-contrib/config.yaml" -e SOONWHY_API_KEY -p 4317:4317 -p 4318:4318 otel/opentelemetry-collector-contrib:0.110.0',
    code: (key?: string, endpoint: string = DEFAULT_INGEST_URL) => `# export SOONWHY_API_KEY=${key ?? 'YOUR_PROJECT_API_KEY'}
receivers:
  otlp:
    protocols:
      grpc:
        endpoint: 0.0.0.0:4317
      http:
        endpoint: 0.0.0.0:4318

processors:
  batch: {}

exporters:
  otlphttp:
    endpoint: ${endpoint}
    headers:
      Authorization: "Bearer \${env:SOONWHY_API_KEY}"

service:
  pipelines:
    traces:
      receivers: [otlp]
      processors: [batch]
      exporters: [otlphttp]
    metrics:
      receivers: [otlp]
      processors: [batch]
      exporters: [otlphttp]
    logs:
      receivers: [otlp]
      processors: [batch]
      exporters: [otlphttp]`,
    note: 'Point your applications at the collector (http://localhost:4318 or localhost:4317). It forwards traces, metrics and logs to Soonwhy over OTLP/HTTP and appends /v1/traces, /v1/metrics and /v1/logs itself.',
  },
  {
    id: 'python',
    label: 'Python',
    fileName: 'terminal',
    install: 'pip install opentelemetry-distro opentelemetry-exporter-otlp-proto-http && opentelemetry-bootstrap -a install',
    code: (key?: string, endpoint: string = DEFAULT_INGEST_URL) => `export OTEL_SERVICE_NAME=my-service
export OTEL_EXPORTER_OTLP_ENDPOINT=${endpoint}
export OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf
export OTEL_EXPORTER_OTLP_HEADERS="Authorization=Bearer%20${key ?? 'YOUR_PROJECT_API_KEY'}"
export OTEL_PYTHON_LOGGING_AUTO_INSTRUMENTATION_ENABLED=true
export OTEL_LOGS_EXPORTER=otlp

opentelemetry-instrument python app.py`,
    note: 'opentelemetry-instrument wraps your process and instruments the libraries it finds (Flask, Django, FastAPI, requests, psycopg and more). Prefix a gunicorn or uvicorn command the same way.',
  },
  {
    id: 'go',
    label: 'Go',
    fileName: 'main.go',
    install: 'go get go.opentelemetry.io/otel go.opentelemetry.io/otel/sdk go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp',
    code: (key?: string, endpoint: string = DEFAULT_INGEST_URL) => `// export OTEL_SERVICE_NAME=my-service
// export OTEL_EXPORTER_OTLP_ENDPOINT=${endpoint}
// export OTEL_EXPORTER_OTLP_HEADERS="Authorization=Bearer%20${key ?? 'YOUR_PROJECT_API_KEY'}"
package main

import (
	"context"
	"log"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
)

func main() {
	ctx := context.Background()

	exporter, err := otlptracehttp.New(ctx)
	if err != nil {
		log.Fatal(err)
	}
	provider := sdktrace.NewTracerProvider(sdktrace.WithBatcher(exporter))
	defer provider.Shutdown(ctx)
	otel.SetTracerProvider(provider)

	// run your server here
}`,
    note: 'The exporter reads the OTEL_EXPORTER_OTLP_* variables, so the key stays out of your code. Wrap your HTTP handlers with otelhttp to create a span per request.',
  },
  {
    id: 'docker',
    label: 'Docker logs',
    fileName: 'otelcol.yaml',
    install: 'docker run -d --name soonwhy-logs -v "$PWD/otelcol.yaml:/etc/otelcol-contrib/config.yaml" -v /var/lib/docker/containers:/var/lib/docker/containers:ro -e SOONWHY_API_KEY otel/opentelemetry-collector-contrib:0.110.0',
    code: (key?: string, endpoint: string = DEFAULT_INGEST_URL) => `# export SOONWHY_API_KEY=${key ?? 'YOUR_PROJECT_API_KEY'}
receivers:
  filelog:
    include: [/var/lib/docker/containers/*/*-json.log]
    include_file_path: true
    operators:
      - type: json_parser
        timestamp:
          parse_from: attributes.time
          layout: "%Y-%m-%dT%H:%M:%S.%LZ"
      - type: move
        from: attributes.log
        to: body

processors:
  batch: {}

exporters:
  otlphttp:
    endpoint: ${endpoint}
    headers:
      Authorization: "Bearer \${env:SOONWHY_API_KEY}"

service:
  pipelines:
    logs:
      receivers: [filelog]
      processors: [batch]
      exporters: [otlphttp]`,
    note: 'Reads the json-file logs of every container on the host and sends them as logs. They carry no service name. The container id is in the log.file.path attribute, so filter on that in log search.',
  },
  {
    id: 'kubernetes',
    label: 'Kubernetes',
    fileName: 'values.yaml',
    install: `kubectl create secret generic soonwhy --from-literal=api-key=YOUR_PROJECT_API_KEY
helm repo add open-telemetry https://open-telemetry.github.io/opentelemetry-helm-charts
helm install soonwhy open-telemetry/opentelemetry-collector -f values.yaml`,
    code: (_key?: string, endpoint: string = DEFAULT_INGEST_URL) => `mode: daemonset
image:
  repository: otel/opentelemetry-collector-k8s
presets:
  logsCollection:
    enabled: true
extraEnvs:
  - name: SOONWHY_API_KEY
    valueFrom:
      secretKeyRef:
        name: soonwhy
        key: api-key
config:
  exporters:
    otlphttp:
      endpoint: ${endpoint}
      headers:
        Authorization: "Bearer \${env:SOONWHY_API_KEY}"
  service:
    pipelines:
      traces:
        exporters: [otlphttp]
      metrics:
        exporters: [otlphttp]
      logs:
        exporters: [otlphttp]`,
    note: 'Runs one collector per node. It collects pod logs and accepts OTLP from your pods at the node on port 4318. The key lives in a Kubernetes secret, not in the values file.',
  },
  {
    id: 'nginx',
    label: 'nginx',
    fileName: 'nginx.conf',
    install: 'apt install nginx-module-otel   # nginx.org packages, nginx 1.25.3 or later',
    code: () => `load_module modules/ngx_otel_module.so;

http {
    otel_exporter {
        endpoint localhost:4317;
    }
    otel_service_name nginx;
    otel_trace on;

    server {
        listen 80;

        location / {
            otel_trace_context propagate;
            proxy_pass http://app:3000;
        }
    }
}`,
    note: 'The nginx module speaks OTLP over gRPC only, and Soonwhy ingests OTLP over HTTP. Run the OpenTelemetry Collector guide on the same host (it listens on localhost:4317) and nginx sends to it.',
  },
] as const;

export type FrameworkId = (typeof FRAMEWORKS)[number]['id'];
