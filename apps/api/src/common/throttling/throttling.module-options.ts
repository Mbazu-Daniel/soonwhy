import type { ThrottlerAsyncOptions } from "@nestjs/throttler";
import { Redis } from "ioredis";
import { RedisThrottlerStorage } from "./redis-throttler.storage";
import { THROTTLER_OPTIONS } from "./throttling.constants";

export const THROTTLER_ASYNC_OPTIONS: ThrottlerAsyncOptions = {
  inject: [Redis],
  useFactory: (redis: Redis) => ({
    ...THROTTLER_OPTIONS,
    storage: new RedisThrottlerStorage(redis),
  }),
};
