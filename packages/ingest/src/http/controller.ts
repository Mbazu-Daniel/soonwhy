import {
  Controller,
  Post,
  Req,
  Res,
  Headers,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
  BadRequestException,
  ForbiddenException,
} from "@nestjs/common";
import { Request, Response } from "express";
import { gunzipSync } from "zlib";
import {
  ApiKeysService,
  apiKeyFromAuthorization,
  NatsService,
  RateLimiter,
  type ValidatedApiKey,
  generateEventId,
} from "@soonwhy/shared";
import { IngestStats } from "../pipeline/stats";
import { IngestConcurrency } from "../pipeline/concurrency";
import { chunkItemsBySize, positiveInt } from "../pipeline/batcher";
import {
  DEFAULT_PUBLISH_BATCH_SIZE,
  DEFAULT_PUBLISH_MAX_BYTES,
} from "../pipeline/constants";
import type { IngestBatch, IngestItem, IngestSignal } from "../pipeline/types";
import { parseTracesPayload } from "../parse/traces";
import { parseLogsPayload } from "../parse/logs";
import { parseMetricsPayload } from "../parse/metrics";
import { decodeProtobufPayload, encodePartialSuccess } from "../parse/protobuf";
import { writeR2Overflow, tryR2Overflow } from "../parse/r2-overflow";
import type { IngestPayload } from "../pipeline/types";

type Signal = IngestSignal;

type ParsedPayload = { items: IngestItem[]; rejected: number };

type SignalMeta = {
  rejectedField: string;
  label: string;
  parse: (raw: Record<string, unknown>) => ParsedPayload;
};

const SIGNAL_META: Record<Signal, SignalMeta> = {
  trace: {
    rejectedField: "rejectedSpans",
    label: "spans",
    parse: (raw) => {
      const r = parseTracesPayload(raw);
      return { items: r.spans as unknown as IngestItem[], rejected: r.rejected };
    },
  },
  log: {
    rejectedField: "rejectedLogRecords",
    label: "log records",
    parse: (raw) => {
      const r = parseLogsPayload(raw);
      return { items: r.records as unknown as IngestItem[], rejected: r.rejected };
    },
  },
  metric: {
    rejectedField: "rejectedDataPoints",
    label: "data points",
    parse: (raw) => {
      const r = parseMetricsPayload(raw);
      return { items: r.points as unknown as IngestItem[], rejected: r.rejected };
    },
  },
};

@Controller()
export class IngestController {
  constructor(
    private readonly apiKeysService: ApiKeysService,
    private readonly rateLimiter: RateLimiter,
    private readonly nats: NatsService,
    private readonly metrics: IngestStats,
    private readonly concurrency: IngestConcurrency,
  ) {}

  private async authenticate(authorization: string | undefined): Promise<ValidatedApiKey> {
    const apiKey = apiKeyFromAuthorization(authorization);
    if (!apiKey) {
      throw new UnauthorizedException("Missing or invalid API key");
    }
    const auth = await this.apiKeysService.validateKey(apiKey);
    if (!auth) {
      throw new UnauthorizedException("Invalid API key");
    }
    return auth;
  }

  private sendError(res: Response, status: number, message: string): void {
    res.status(status).json({ error: message });
  }

  private async readBody(req: Request, contentEncoding: string | undefined): Promise<Buffer> {
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    const body = Buffer.concat(chunks);
    if (contentEncoding === "gzip") {
      return gunzipSync(body);
    }
    return body;
  }

  private decodePayload(body: Buffer, contentType: string | undefined, signal: Signal): Record<string, unknown> | null {
    if (contentType?.includes("protobuf")) {
      return decodeProtobufPayload(body, signal);
    }
    try {
      return JSON.parse(body.toString("utf-8"));
    } catch {
      return null;
    }
  }

  private sendPartialSuccess(
    res: Response,
    contentType: string | undefined,
    signal: Signal,
    rejected: number,
    rejectedField: string,
    label: string,
  ): void {
    if (contentType?.includes("protobuf")) {
      res.status(200).end();
      return;
    }
    res.status(200).json({
      partialSuccess: {
        rejectedSpans: signal === "trace" ? rejected : 0,
        rejectedLogRecords: signal === "log" ? rejected : 0,
        rejectedDataPoints: signal === "metric" ? rejected : 0,
        [rejectedField]: rejected,
        errorMessage: rejected > 0 ? `Rejected ${rejected} ${label}` : undefined,
      },
    });
  }

  @Post("v1/traces")
  @HttpCode(HttpStatus.OK)
  async trace(
    @Req() req: Request,
    @Res() res: Response,
    @Headers("content-type") contentType: string,
    @Headers("content-encoding") contentEncoding: string,
    @Headers("authorization") authorization: string,
  ) {
    return this.ingest(req, res, contentType, contentEncoding, authorization, "trace");
  }

  @Post("v1/logs")
  @HttpCode(HttpStatus.OK)
  async log(
    @Req() req: Request,
    @Res() res: Response,
    @Headers("content-type") contentType: string,
    @Headers("content-encoding") contentEncoding: string,
    @Headers("authorization") authorization: string,
  ) {
    return this.ingest(req, res, contentType, contentEncoding, authorization, "log");
  }

  @Post("v1/metrics")
  @HttpCode(HttpStatus.OK)
  async metric(
    @Req() req: Request,
    @Res() res: Response,
    @Headers("content-type") contentType: string,
    @Headers("content-encoding") contentEncoding: string,
    @Headers("authorization") authorization: string,
  ) {
    return this.ingest(req, res, contentType, contentEncoding, authorization, "metric");
  }

  private async ingest(
    req: Request,
    res: Response,
    contentType: string | undefined,
    contentEncoding: string | undefined,
    authorization: string | undefined,
    signal: Signal,
  ) {
    const started = Date.now();
    const meta = SIGNAL_META[signal];
    let acquired = false;
    let organizationId: string | undefined;
    try {
      const auth = await this.authenticate(authorization);
      organizationId = auth.organizationId;
      if (!(await this.rateLimiter.checkRateLimit(auth.organizationId))) {
        res.setHeader("Retry-After", "1");
        return this.sendError(res, 429, "OTLP ingestion rate limit exceeded");
      }
      if (!this.concurrency.tryAcquire(auth.organizationId)) {
        res.setHeader("Retry-After", "1");
        return this.sendError(res, 503, "OTLP ingestion capacity is saturated");
      }
      this.metrics.beginRequest();
      acquired = true;

      const body = await this.readBody(req, contentEncoding);
      const parsed = this.decodePayload(body, contentType, signal);
      if (!parsed)
        return this.sendError(res, 400, `Invalid OTLP ${signal} payload`);

      const result = meta.parse(parsed);
      const accepted = result.items.slice(0, 10000);
      const rejected =
        result.rejected + Math.max(0, result.items.length - 10000);
      try {
        await this.publish(auth, signal, accepted);
      } catch {
        this.metrics.recordError();
        res.setHeader("Retry-After", "1");
        return this.sendError(res, 503, "Ingest queue is unavailable");
      }
      this.metrics.recordAccepted(accepted.length);
      this.metrics.recordRejected(rejected);
      this.metrics.recordLatency(Date.now() - started);

      return this.sendPartialSuccess(
        res,
        contentType,
        signal,
        rejected,
        meta.rejectedField,
        meta.label,
      );
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      this.metrics.recordError();
      return this.sendError(res, 400, `Invalid OTLP ${signal} request`);
    } finally {
      if (acquired && organizationId) {
        this.metrics.endRequest();
        this.concurrency.release(organizationId);
      }
    }
  }

  private async publish(
    auth: ValidatedApiKey,
    signal: Signal,
    items: IngestItem[],
  ): Promise<void> {
    const batchSize = positiveInt(
      process.env.INGEST_PUBLISH_BATCH_SIZE,
      DEFAULT_PUBLISH_BATCH_SIZE,
    );
    const maxBytes = positiveInt(
      process.env.INGEST_PUBLISH_MAX_BYTES,
      DEFAULT_PUBLISH_MAX_BYTES,
    );
    const encoder = new TextEncoder();

    // Check if the total payload exceeds the max bytes limit and overflow to R2 if needed
    const overflowInfo = tryR2Overflow(items, maxBytes, encoder);
    if (overflowInfo.overflowed) {
      // Items that overflowed were written to R2; we only publish the summary
      // this.metrics.recordOverflow(overflowInfo.overflowedCount);
    }

    // Chunk the remaining items (those that fit within maxBytes)
    const chunks = chunkItemsBySize(items, batchSize, overflowInfo.remainingBytes, (item) =>
      encoder.encode(JSON.stringify(item)),
    );

    for (const chunk of chunks) {
      const eventId = generateEventId({
        signal,
        organizationId: auth.organizationId,
        projectId: auth.projectId,
        captureSettings: auth.captureSettings,
        // Exclude ingest-time fields from the event ID
        itemCount: chunk.length,
      });

      const batch: IngestBatch = {
        version: 1,
        signal,
        projectId: auth.projectId,
        organizationId: auth.organizationId,
        captureSettings: auth.captureSettings,
        items: chunk,
      };

      // Publish with JetStream ack and wait for confirmation
      const ack = await this.nats.publishWithAck(
        `ingest.${auth.projectId}.${signal}`,
        encoder.encode(JSON.stringify(batch)),
        eventId,
      );
      if (!ack) {
        throw new Error("NATS JetStream publish failed - no acknowledgment received");
      }

      this.metrics.recordPublished(chunk.length);
    }
  }
}