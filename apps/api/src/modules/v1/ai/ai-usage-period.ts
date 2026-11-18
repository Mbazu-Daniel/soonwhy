import { BadRequestException } from "@nestjs/common";

export const USAGE_PERIODS = ["month", "last_month", "last_30_days"] as const;

export type UsagePeriod = (typeof USAGE_PERIODS)[number];

const DAY_MS = 24 * 60 * 60 * 1000;

export function parseUsagePeriod(value: string | undefined): UsagePeriod {
  if (value === undefined || value === "") return "month";
  if ((USAGE_PERIODS as readonly string[]).includes(value)) return value as UsagePeriod;
  throw new BadRequestException({
    code: "AI_USAGE_PERIOD_INVALID",
    title: "Unknown usage period",
    detail: `"${value}" is not a usage period.`,
    hint: `Use one of: ${USAGE_PERIODS.join(", ")}.`,
  });
}

export function usagePeriodRange(period: UsagePeriod, now: Date): { start: Date; end: Date } {
  const thisMonth = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);
  if (period === "last_month") {
    return {
      start: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)),
      end: new Date(thisMonth),
    };
  }
  if (period === "last_30_days") {
    return { start: new Date(now.getTime() - 30 * DAY_MS), end: now };
  }
  return { start: new Date(thisMonth), end: now };
}
