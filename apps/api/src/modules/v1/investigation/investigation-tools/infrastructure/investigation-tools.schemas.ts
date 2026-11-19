import * as z from "zod4";
import { TOOL_DEFAULT_LIMIT, TOOL_DEFAULT_RANGE_HOURS, TOOL_MAX_LIMIT, TOOL_MAX_RANGE_HOURS } from "../domain/investigation-tools.constants";

const hours = z
  .number()
  .int()
  .min(1)
  .max(TOOL_MAX_RANGE_HOURS)
  .default(TOOL_DEFAULT_RANGE_HOURS)
  .describe(`How many hours back to search, up to ${TOOL_MAX_RANGE_HOURS}. Defaults to ${TOOL_DEFAULT_RANGE_HOURS}.`);

const limit = z
  .number()
  .int()
  .min(1)
  .max(TOOL_MAX_LIMIT)
  .default(TOOL_DEFAULT_LIMIT)
  .describe(`Maximum rows to return, up to ${TOOL_MAX_LIMIT}.`);

const service = z.string().max(200).optional().describe("Only this service name");

export const listErrorGroupsSchema = z.object({ hours, limit, service });
export const getErrorGroupSchema = z.object({
  fingerprint: z.string().min(1).max(64).describe("The fingerprint returned by list_error_groups"),
  hours,
});
export const listLogsSchema = z.object({
  hours,
  limit,
  service,
  level: z.enum(["debug", "info", "warn", "error", "fatal"]).optional().describe("Only this level"),
  traceId: z.string().max(64).optional().describe("Only logs from this trace"),
  query: z.string().max(200).optional().describe("Text to search for in the message"),
});
export const listTracesSchema = z.object({ hours, limit, service, query: z.string().max(200).optional() });
export const getTraceSchema = z.object({ traceId: z.string().min(1).max(64).describe("A trace id") });
export const listFindingsSchema = z.object({ limit });
export const getRcaSchema = z.object({
  findingId: z.string().min(1).max(64).describe("A finding id from list_findings"),
});
