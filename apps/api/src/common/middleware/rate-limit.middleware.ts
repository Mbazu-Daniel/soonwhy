import { Injectable, Logger, NestMiddleware } from "@nestjs/common";
import { Request, Response, NextFunction } from "express";

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

@Injectable()
export class RateLimitMiddleware implements NestMiddleware {
  private readonly logger = new Logger(RateLimitMiddleware.name);
  private readonly limits = new Map<string, RateLimitConfig>();
  private readonly trackers = new Map<string, RateLimitEntry>();

  constructor() {
    // Default limits per endpoint type
    this.limits.set("default", { windowMs: 60000, maxRequests: 100 });
    this.limits.set("ai-investigation", { windowMs: 60000, maxRequests: 10 });
    this.limits.set("ai-intelligence", { windowMs: 60000, maxRequests: 50 });
  }

  use(req: Request, res: Response, next: NextFunction): void {
    const key = this.getKey(req);
    const limit = this.getLimit(req.path);

    const now = Date.now();
    const entry = this.trackers.get(key);

    if (!entry || now > entry.resetTime) {
      this.trackers.set(key, {
        count: 1,
        resetTime: now + limit.windowMs,
      });
      next();
      return;
    }

    if (entry.count >= limit.maxRequests) {
      const resetAfter = Math.ceil((entry.resetTime - now) / 1000);
      res.setHeader("X-RateLimit-Limit", limit.maxRequests.toString());
      res.setHeader("X-RateLimit-Remaining", "0");
      res.setHeader("X-RateLimit-Reset", resetAfter.toString());
      res.setHeader("Retry-After", resetAfter.toString());

      this.logger.warn(`Rate limit exceeded for ${key}`);
      res.status(429).json({
        error: "Too Many Requests",
        message: `Rate limit exceeded. Try again in ${resetAfter} seconds.`,
        retryAfter: resetAfter,
      });
      return;
    }

    entry.count++;
    res.setHeader("X-RateLimit-Limit", limit.maxRequests.toString());
    res.setHeader("X-RateLimit-Remaining", (limit.maxRequests - entry.count).toString());
    res.setHeader("X-RateLimit-Reset", Math.ceil((entry.resetTime - now) / 1000).toString());

    next();
  }

  private getKey(req: Request): string {
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    const path = req.path;
    return `${ip}:${path}`;
  }

  private getLimit(path: string): RateLimitConfig {
    if (path.includes("/ai-investigation")) {
      return this.limits.get("ai-investigation")!;
    }
    if (path.includes("/ai-intelligence")) {
      return this.limits.get("ai-intelligence")!;
    }
    return this.limits.get("default")!;
  }

  clearExpiredEntries(): void {
    const now = Date.now();
    for (const [key, entry] of this.trackers.entries()) {
      if (now > entry.resetTime) {
        this.trackers.delete(key);
      }
    }
  }
}
