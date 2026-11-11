import type { ThrottlerModuleOptions } from "@nestjs/throttler";

export const THROTTLER_NAMES = {
  burst: "burst",
  sustained: "sustained",
} as const;

export const THROTTLER_OPTIONS: ThrottlerModuleOptions = {
  throttlers: [
    {
      name: THROTTLER_NAMES.burst,
      ttl: 1_000,
      limit: Number(process.env.RATE_LIMIT_BURST) || 50,
    },
    {
      name: THROTTLER_NAMES.sustained,
      ttl: 60_000,
      limit: Number(process.env.RATE_LIMIT_SUSTAINED) || 1_200,
    },
  ],
  skipIf: () => process.env.RATE_LIMIT_DISABLED === "1",
  errorMessage: "Too many requests",
};

export const AUTH_THROTTLE = {
  burst: { limit: 3, ttl: 10_000 },
  sustained: { limit: 10, ttl: 60_000 },
};

export const INGEST_THROTTLE = {
  burst: { limit: 100, ttl: 1_000 },
  sustained: { limit: 6_000, ttl: 60_000 },
};

export const SKIP_ALL_THROTTLERS = {
  [THROTTLER_NAMES.burst]: true,
  [THROTTLER_NAMES.sustained]: true,
};
