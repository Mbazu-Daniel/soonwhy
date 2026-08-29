import { randomUUID } from 'node:crypto';

export interface SoonwhyConfig {
  apiKey: string;
  baseUrl?: string;
  flushInterval?: number;
  maxBatchSize?: number;
  maxRetries?: number;
  enabled?: boolean;
}

export interface TelemetryEvent {
  id: string;
  timestamp: number;
  type: 'log' | 'metric' | 'error' | 'request' | 'trace';
  projectId: string;
  service?: string;
  data: Record<string, unknown>;
}

const DEFAULT_CONFIG: Required<Omit<SoonwhyConfig, 'apiKey'>> = {
  baseUrl: 'http://localhost:3001/api',
  flushInterval: 5000,
  maxBatchSize: 100,
  maxRetries: 3,
  enabled: true,
};

export class SoonwhyClient {
  private config: Required<SoonwhyConfig>;
  private buffer: TelemetryEvent[] = [];
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private projectId: string = '';
  private service: string = '';
  private isShuttingDown = false;

  constructor(config: SoonwhyConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.projectId = this.extractProjectId(config.apiKey);

    if (this.config.enabled) {
      this.startFlushTimer();
      this.setupExitHandler();
    }
  }

  private extractProjectId(apiKey: string): string {
    // API key format: sk_<projectId>_<secret>
    const parts = apiKey.split('_');
    if (parts.length >= 2) {
      return parts[1];
    }
    return '';
  }

  private startFlushTimer() {
    this.flushTimer = setInterval(() => {
      this.flush();
    }, this.config.flushInterval);
  }

  private setupExitHandler() {
    const exit = async () => {
      if (this.isShuttingDown) return;
      this.isShuttingDown = true;
      await this.flush();
    };

    process.on('exit', exit);
    process.on('SIGINT', exit);
    process.on('SIGTERM', exit);
  }

  setService(service: string) {
    this.service = service;
  }

  captureLog(data: {
    level: 'debug' | 'info' | 'warn' | 'error' | 'fatal';
    message: string;
    attributes?: Record<string, unknown>;
    stackTrace?: string;
  }) {
    this.addEvent({
      id: randomUUID(),
      timestamp: Date.now(),
      type: 'log',
      projectId: this.projectId,
      service: this.service,
      data,
    });
  }

  captureError(data: {
    errorType: string;
    errorMessage: string;
    stack?: string;
    fingerprint?: string;
  }) {
    this.addEvent({
      id: randomUUID(),
      timestamp: Date.now(),
      type: 'error',
      projectId: this.projectId,
      service: this.service,
      data,
    });
  }

  captureMetric(data: {
    name: string;
    value: number;
    unit: 'ms' | 'count' | 'bytes' | 'percent';
  }) {
    this.addEvent({
      id: randomUUID(),
      timestamp: Date.now(),
      type: 'metric',
      projectId: this.projectId,
      service: this.service,
      data,
    });
  }

  captureRequest(data: {
    method: string;
    url: string;
    statusCode: number;
    duration: number;
    userAgent?: string;
    ip?: string;
  }) {
    this.addEvent({
      id: randomUUID(),
      timestamp: Date.now(),
      type: 'request',
      projectId: this.projectId,
      service: this.service,
      data,
    });
  }

  captureTrace(data: {
    traceId: string;
    spanId: string;
    parentSpanId?: string;
    name: string;
    duration: number;
  }) {
    this.addEvent({
      id: randomUUID(),
      timestamp: Date.now(),
      type: 'trace',
      projectId: this.projectId,
      service: this.service,
      data,
    });
  }

  private addEvent(event: TelemetryEvent) {
    if (!this.config.enabled) return;

    this.buffer.push(event);

    if (this.buffer.length >= this.config.maxBatchSize) {
      this.flush();
    }
  }

  async flush(): Promise<void> {
    if (this.buffer.length === 0) return;

    const batch = [...this.buffer];
    this.buffer = [];

    await this.sendBatch(batch);
  }

  private async sendBatch(batch: TelemetryEvent[], retryCount = 0): Promise<void> {
    try {
      const response = await fetch(`${this.config.baseUrl}/v1/ingest`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({ batch }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      if (retryCount < this.config.maxRetries) {
        const delay = Math.min(1000 * 2 ** retryCount, 10000);
        await new Promise((resolve) => setTimeout(resolve, delay));
        await this.sendBatch(batch, retryCount + 1);
      }
      // Fail-open: silently drop events if all retries fail
    }
  }

  get bufferLength(): number {
    return this.buffer.length;
  }

  get isFlushed(): boolean {
    return this.buffer.length === 0;
  }
}
