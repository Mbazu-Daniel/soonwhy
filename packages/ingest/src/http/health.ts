import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Req,
  Res,
  UnauthorizedException,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { NatsService } from "@soonwhy/shared";
import { IngestConcurrency } from "../pipeline/concurrency";
import { IngestStats } from "../pipeline/stats";

@Controller("api/health")
export class HealthController {
  constructor(
    private readonly nats: NatsService,
    private readonly stats: IngestStats,
    private readonly concurrency: IngestConcurrency,
  ) {}

  @Get()
  async status(@Res({ passthrough: true }) res: Response) {
    const ready = this.nats.isReady();
    res.status(ready ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE);
    return {
      status: ready ? "ok" : "degraded",
      ready,
      queue: {
        provider: "nats-jetstream",
        connected: ready,
      },
    };
  }

  @Get("live")
  @HttpCode(HttpStatus.OK)
  live() {
    return { status: "ok" };
  }

  @Get("stats")
  @HttpCode(HttpStatus.OK)
  async statsSnapshot(@Req() req: Request) {
    const token = process.env.INGEST_HEALTH_TOKEN;
    if (token) {
      const auth = req.headers.authorization;
      if (auth !== `Bearer ${token}`) {
        throw new UnauthorizedException("Set INGEST_HEALTH_TOKEN and send it as a bearer token.");
      }
    }
    return {
      stats: this.stats.snapshot(),
      capacity: this.concurrency.snapshot(),
      consumers: this.nats.isReady() ? await this.nats.consumerSnapshot() : [],
    };
  }
}
