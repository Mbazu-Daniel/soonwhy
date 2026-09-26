import { Controller, Post, Req, Res, Headers, HttpCode, HttpStatus, UnauthorizedException, Logger } from '@nestjs/common';
import { Request, Response } from 'express';
import { gunzipSync } from 'zlib';
import { ApiKeysService, apiKeyFromAuthorization, NatsService, RateLimiter, type ValidatedApiKey } from '@soonwhy/shared';
import { IngestConcurrency } from '../pipeline/concurrency';
import { IngestStats } from '../pipeline/stats';
import { parseTracesPayload } from '../parse/traces';
import { parseLogsPayload } from '../parse/logs';
import { parseMetricsPayload } from '../parse/metrics';
import { decodeProtobufPayload, encodePartialSuccess } from '../parse/protobuf';

type Signal = 'trace' | 'log' | 'metric';
type ParsedPayload = Record<string, unknown>;

const SIGNAL_META: Record<Signal, { rejectedField: string; label: string; parse: (p: ParsedPayload) => { items: unknown[]; rejected: number } }> = {
  trace: { rejectedField: 'rejectedSpans', label: 'spans', parse: (p) => { const r = parseTracesPayload(p); return { items: r.spans, rejected: r.rejected }; } },
  log: { rejectedField: 'rejectedLogRecords', label: 'log records', parse: (p) => { const r = parseLogsPayload(p); return { items: r.records, rejected: r.rejected }; } },
  metric: { rejectedField: 'rejectedDataPoints', label: 'data points', parse: (p) => { const r = parseMetricsPayload(p); return { items: r.points, rejected: r.rejected }; } },
};

@Controller('v1')
export class IngestController {
  private readonly logger = new Logger(IngestController.name);

  constructor(
    private readonly apiKeysService: ApiKeysService,
    private readonly rateLimiter: RateLimiter,
    private readonly nats: NatsService,
    private readonly metrics: IngestStats,
    private readonly concurrency: IngestConcurrency,
  ) {}

  @Post('traces')
  @HttpCode(HttpStatus.OK)
  async handleTraces(@Req() req: Request, @Res() res: Response, @Headers('content-type') contentType: string, @Headers('content-encoding') contentEncoding: string, @Headers('authorization') authorization: string) {
    return this.ingest(req, res, contentType, contentEncoding, authorization, 'trace');
  }

  @Post('logs')
  @HttpCode(HttpStatus.OK)
  async handleLogs(@Req() req: Request, @Res() res: Response, @Headers('content-type') contentType: string, @Headers('content-encoding') contentEncoding: string, @Headers('authorization') authorization: string) {
    return this.ingest(req, res, contentType, contentEncoding, authorization, 'log');
  }

  @Post('metrics')
  @HttpCode(HttpStatus.OK)
  async handleMetrics(@Req() req: Request, @Res() res: Response, @Headers('content-type') contentType: string, @Headers('content-encoding') contentEncoding: string, @Headers('authorization') authorization: string) {
    return this.ingest(req, res, contentType, contentEncoding, authorization, 'metric');
  }

  private async ingest(req: Request, res: Response, contentType: string | undefined, contentEncoding: string | undefined, authorization: string | undefined, signal: Signal) {
    const started = Date.now();
    const meta = SIGNAL_META[signal];
    let acquired = false;
    let organizationId: string | undefined;
    try {
      const auth = await this.authenticate(authorization);
      organizationId = auth.organizationId;
      if (!(await this.rateLimiter.checkRateLimit(auth.organizationId))) {
        res.setHeader('Retry-After', '1');
        return this.sendError(res, 429, 'OTLP ingestion rate limit exceeded');
      }
      if (!this.concurrency.tryAcquire(auth.organizationId)) {
        res.setHeader('Retry-After', '1');
        return this.sendError(res, 503, 'OTLP ingestion capacity is saturated');
      }
      this.metrics.beginRequest();
      acquired = true;

      const body = await this.readBody(req, contentEncoding);
      const parsed = this.decodePayload(body, contentType, signal);
      if (!parsed) return this.sendError(res, 400, `Invalid OTLP ${signal} payload`);

      const result = meta.parse(parsed);
      const accepted = result.items.slice(0, 10000);
      const rejected = result.rejected + Math.max(0, result.items.length - 10000);
      await this.publish(auth, signal, accepted);
      this.metrics.recordAccepted(accepted.length);
      this.metrics.recordRejected(rejected);
      this.metrics.recordLatency(Date.now() - started);

      return this.sendPartialSuccess(res, contentType, signal, rejected, meta.rejectedField, meta.label);
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      this.logger.error(`OTLP ${signal} failed`, error as Error);
      this.metrics.recordError();
      return this.sendError(res, 400, `Invalid OTLP ${signal} request`);
    } finally {
      if (acquired && organizationId) {
        this.metrics.endRequest();
        this.concurrency.release(organizationId);
      }
    }
  }

  private async readBody(req: Request, contentEncoding?: string): Promise<Buffer> {
    const chunks: Buffer[] = [];
    let size = 0;
    const maxPayload = 50 * 1024 * 1024;
    for await (const chunk of req) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      size += buffer.byteLength;
      if (size > maxPayload) throw new Error('Payload too large');
      chunks.push(buffer);
    }
    const encoded = Buffer.concat(chunks);
    const encoding = contentEncoding?.toLowerCase();
    if (!encoding || encoding === 'identity') return encoded;
    if (encoding !== 'gzip') throw new Error('Unsupported Content-Encoding');
    return gunzipSync(encoded, { maxOutputLength: maxPayload + 1 });
  }

  private decodePayload(body: Buffer, contentType: string | undefined, type: Signal): Record<string, unknown> | null {
    const ct = contentType?.split(';', 1)[0]?.trim().toLowerCase();
    if (ct === 'application/json' || ct === 'application/json; charset=utf-8') {
      try { return JSON.parse(body.toString('utf8')); } catch { return null; }
    }
    if (ct === 'application/x-protobuf' || ct === 'application/protobuf') return decodeProtobufPayload(body, type);
    try { return JSON.parse(body.toString('utf8')); } catch { return decodeProtobufPayload(body, type); }
  }

  private async authenticate(authorization: string | undefined): Promise<ValidatedApiKey> {
    const apiKey = apiKeyFromAuthorization(authorization);
    if (!apiKey) throw new UnauthorizedException('Missing API key');
    const result = await this.apiKeysService.validateKey(apiKey);
    if (!result) throw new UnauthorizedException('Invalid API key');
    return result;
  }

  private async publish(auth: ValidatedApiKey, signal: Signal, items: unknown[]) {
    for (const item of items) {
      await this.nats.publish(`ingest.${auth.projectId}.${signal}`, new TextEncoder().encode(JSON.stringify({ ...(item as object), projectId: auth.projectId, organizationId: auth.organizationId, captureSettings: auth.captureSettings })));
      this.metrics.recordPublished(1);
    }
  }

  private sendPartialSuccess(res: Response, contentType: string | undefined, signal: Signal, rejected: number, rejectedField: string, typeLabel: string) {
    const errorMessage = rejected ? `${rejected} invalid or over-limit ${typeLabel} were rejected` : '';
    const ct = contentType?.split(';', 1)[0]?.trim().toLowerCase();
    const wantsProtobuf = ct === 'application/x-protobuf' || ct === 'application/protobuf';
    if (wantsProtobuf) {
      res.status(200).setHeader('Content-Type', 'application/x-protobuf').send(Buffer.from(encodePartialSuccess(signal, rejected, errorMessage)));
      return;
    }
    res.status(200).json(rejected ? { partialSuccess: { [rejectedField]: rejected, errorMessage } } : {});
  }

  private sendError(res: Response, status: number, message: string) {
    res.status(status).json({ message });
  }
}
