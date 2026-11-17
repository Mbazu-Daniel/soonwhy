import { Injectable } from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";
import { resolveThrottleTracker } from "./throttling.tracker";
import type { ThrottleRequest } from "./throttling.types";

@Injectable()
export class ApiThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(request: ThrottleRequest): Promise<string> {
    return resolveThrottleTracker(request);
  }
}
