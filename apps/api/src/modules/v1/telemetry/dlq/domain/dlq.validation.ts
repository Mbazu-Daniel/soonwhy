import { BadRequestException } from "@nestjs/common";
import { BULK_MAX_IDS, CLEANUP_DEFAULT_DAYS, CLEANUP_MAX_DAYS, CLEANUP_MIN_DAYS } from "./dlq.constants";

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

export function parseEntryId(raw: string): number {
  const id = Number(raw);
  if (!isPositiveInteger(id)) throw new BadRequestException("Entry id must be a positive integer");
  return id;
}

export function parseEntryIds(value: unknown): number[] {
  if (!Array.isArray(value) || value.length === 0) throw new BadRequestException("ids must be a non-empty array");
  if (!value.every(isPositiveInteger)) throw new BadRequestException("ids must be positive integers");

  const unique = [...new Set<number>(value)];
  if (unique.length > BULK_MAX_IDS) {
    throw new BadRequestException(`At most ${BULK_MAX_IDS} distinct ids are allowed per call`);
  }
  return unique;
}

export function parseRetentionDays(value: unknown): number {
  if (value === undefined || value === null) return CLEANUP_DEFAULT_DAYS;
  if (!Number.isInteger(value) || (value as number) < CLEANUP_MIN_DAYS || (value as number) > CLEANUP_MAX_DAYS) {
    throw new BadRequestException(`daysOld must be an integer from ${CLEANUP_MIN_DAYS} to ${CLEANUP_MAX_DAYS}`);
  }
  return value as number;
}
