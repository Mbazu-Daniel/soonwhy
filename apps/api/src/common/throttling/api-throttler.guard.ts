import { Injectable } from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";
import { resolveThrottleTracker } from "./throttling.tracker";

@Injectable()
export class ApiThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(request: Record<string, any>): Promise<string> {
    return resolveThrottleTracker(request);
  }
}
