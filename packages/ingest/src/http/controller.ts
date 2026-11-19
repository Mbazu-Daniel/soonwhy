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
  Logger,
} from "@nestjs/common";
import { Request, Response } from "express";
import {
  ApiKeyAuthenticator,
  HostMetricsTarget,
  HostRegistry,
  NatsService,
  RateLimiter,
  type ValidatedApiKey,
} from "@soonwhy/shared";
import { groupByHost } from "./host-groups";
import { PayloadTooLargeError } from "./payload-too-large.error";
import { readLimitedBody } from "./read-body";
import { internalPortFrom, isInternalRequest } from "./internal-listener";
import { IngestStats } from "../pipeline/stats";
import { IngestConcurrency } from "../pipeline/concurrency";
import { chunkItemsBySize, positiveInt } from "../pipeline/batcher";
import { batchEventId } from "../pipeline/batch-id";
import {
  DEFAULT_PUBLISH_BATCH_SIZE,
  DEFAULT_PUBLISH_MAX_BYTES,
} from "../pipeline/constants";
import type { IngestBatch, IngestItem, IngestSignal } from "../pipeline/types";
import type { OtlpLogsPayload, OtlpTracesPayload } from "../parse/otlp.types";
import { parseTracesPayload } from "../parse/traces";
import { parseLogsPayload } from "../parse/logs";
import { parseMetricsPayload } from "../parse/metrics";
import { decodeProtobufPayload } from "../parse/protobuf";

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
      const r = parseTracesPayload(raw as OtlpTracesPayload);
      return { items: r.spans as unknown as IngestItem[], rejected: r.rejected };
    },
  },
  log: {
    rejectedField: "rejectedLogRecords",
    label: "log records",
    parse: (raw) => {
      const r = parseLogsPayload(raw as OtlpLogsPayload);
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
  private readonly logger = new Logger(IngestController.name);
  private readonly internalPort = internalPortFrom(
    process.env.INGEST_INTERNAL_PORT,
    Number(process.env.INGEST_PORT ?? 3002),
  );

  constructor(
    private readonly apiKeys: ApiKeyAuthenticator,
    private readonly hostTarget: HostMetricsTarget,
    private readonly hostRegistry: HostRegistry,
    private readonly rateLimiter: RateLimiter,
    private readonly nats: NatsService,
    private readonly metrics: IngestStats,
    private readonly concurrency: IngestConcurrency,
  ) {}

  private async authenticate(authorization: string | undefined): Promise<ValidatedApiKey> {
    const result = await this.apiKeys.authenticate(authorization);
    if (!result.ok) throw new UnauthorizedException(result.message);
    return result.key;
  }

  private sendError(res: Response, status: number, message: string): void {
    res.status(status).json({ error: message });
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
      const trusted = !authorization && isInternalRequest(req, this.internalPort);
      if (trusted && signal !== "metric") {
        return this.sendError(res, 404, "Only metrics are accepted on this port");
      }
      let auth: ValidatedApiKey | undefined;
      if (trusted) {
        try {
          auth = await this.hostTarget.resolve();
        } catch (error) {
          this.logger.warn(
            `Could not look up the host metrics project: ${error instanceof Error ? error.message : String(error)}`,
          );
          res.setHeader("Retry-After", "5");
          return this.sendError(res, 503, "Host metrics project could not be looked up");
        }
      } else {
        auth = await this.authenticate(authorization);
      }
      if (!auth) {
        return this.sendError(res, 503, "No project exists yet to file host metrics under");
      }
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

      const body = await readLimitedBody(req, contentEncoding);
      const parsed = this.decodePayload(body, contentType, signal);
      if (!parsed)
        return this.sendError(res, 400, `Invalid OTLP ${signal} payload`);

      const result = meta.parse(parsed);
      const accepted = result.items.slice(0, 10000);
      const rejected =
        result.rejected + Math.max(0, result.items.length - 10000);
      let targets: Array<{ auth: ValidatedApiKey; items: IngestItem[] }>;
      try {
        targets = await this.publishTargets(auth, trusted, accepted);
      } catch (error) {
        this.logger.warn(
          `Could not look up the host's project: ${error instanceof Error ? error.message : String(error)}`,
        );
        res.setHeader("Retry-After", "5");
        return this.sendError(res, 503, "Host project could not be looked up");
      }
      try {
        for (const target of targets) await this.publish(target.auth, signal, target.items);
      } catch (error) {
        this.metrics.recordError();
        this.logger.error(
          `Failed to publish ${signal} batch (${accepted.length} items) to NATS: ${
            error instanceof Error ? error.message : String(error)
          }`,
          error instanceof Error ? error.stack : undefined,
        );
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
      if (error instanceof PayloadTooLargeError) {
        return this.sendError(res, 413, error.message);
      }
      if (!(error instanceof BadRequestException)) {
        this.logger.error(
          `Failed to process OTLP ${signal} request: ${
            error instanceof Error ? error.message : String(error)
          }`,
          error instanceof Error ? error.stack : undefined,
        );
      }
      return this.sendError(res, 400, `Invalid OTLP ${signal} request`);
    } finally {
      if (acquired && organizationId) {
        this.metrics.endRequest();
        this.concurrency.release(organizationId);
      }
    }
  }

  private async publishTargets(
    auth: ValidatedApiKey,
    trusted: boolean,
    items: IngestItem[],
  ): Promise<Array<{ auth: ValidatedApiKey; items: IngestItem[] }>> {
    if (!trusted) return [{ auth, items }];
    const targets: Array<{ auth: ValidatedApiKey; items: IngestItem[] }> = [];
    for (const [hostName, group] of groupByHost(items)) {
      const resolved = await this.hostRegistry.resolve(hostName || undefined);
      targets.push({ auth: resolved ?? auth, items: group });
    }
    return targets;
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

    const chunks = chunkItemsBySize(items, batchSize, maxBytes, (item) =>
      encoder.encode(JSON.stringify(item)),
    );

    for (const chunk of chunks) {
      const eventId = batchEventId(
        {
          signal,
          organizationId: auth.organizationId,
          projectId: auth.projectId,
          captureSettings: auth.captureSettings,
        },
        chunk,
      );

      const batch: IngestBatch = {
        version: 1,
        signal,
        projectId: auth.projectId,
        organizationId: auth.organizationId,
        captureSettings: auth.captureSettings,
        items: chunk,
      };

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