import { Injectable } from "@nestjs/common";
import { assertSafeUserQuery, userQueryFailure } from "../../../common/quickwit/user-query";
import { LogsRepository, type LogFilter, type RawLogRow } from "./logs.repository";
import type { ExportLogsInput, GetContextInput, GetFieldValuesInput, GetLogsInput } from "./dto";
import { EXPORT_PAGE_SIZE } from "./logs.constants";
import { splitContext } from "./log-context";
import { exportFile, toCsv, toNdjson } from "./log-export";
import { assertQueryableField, fieldNamesFromSample, parseAttributes } from "./log-fields";
import { decodeOffset, nextOffsetCursor } from "./logs.cursor";

@Injectable()
export class LogsService {
  constructor(private readonly logsRepository: LogsRepository) {}

  private filterOf(orgId: string, input: Omit<GetLogsInput, "limit" | "cursor">): LogFilter {
    return {
      orgId,
      projectId: input.projectId,
      from: input.from ?? new Date(0).toISOString(),
      to: input.to ?? new Date().toISOString(),
      level: input.level || "all",
      service: input.service || "",
      q: assertSafeUserQuery(input.q ?? ""),
      traceId: input.traceId,
      spanId: input.spanId,
    };
  }

  private async guarded<T>(run: () => Promise<T>): Promise<T> {
    try {
      return await run();
    } catch (error) {
      throw userQueryFailure(error) ?? error;
    }
  }

  async getHistogram(orgId: string, input: GetLogsInput) {
    const filter = this.filterOf(orgId, input);
    const result = await this.guarded(() => this.logsRepository.queryHistogram(filter));
    return { ...result.aggregations, total: result.total };
  }

  async getFields(orgId: string, input: GetLogsInput) {
    const filter = this.filterOf(orgId, input);
    const sample = await this.guarded(() => this.logsRepository.queryFieldSample(filter));
    return { data: fieldNamesFromSample(sample), sampled: sample.length };
  }

  async getFieldValues(orgId: string, input: GetFieldValuesInput) {
    const filter = this.filterOf(orgId, input);
    const field = assertQueryableField(input.field);
    const values = await this.guarded(() =>
      this.logsRepository.queryFieldValues({ ...filter, field, size: input.size }),
    );
    return { field, data: values };
  }

  async getContext(orgId: string, input: GetContextInput) {
    const field = assertQueryableField(input.field);
    const anchorMs = Date.parse(input.timestamp);
    const near = await this.guarded(() =>
      this.logsRepository.queryContext({ orgId, projectId: input.projectId, field, value: input.value, anchorMs, lines: input.lines }),
    );
    const context = splitContext({ id: input.id, timestamp: input.timestamp }, near.before, near.after, input.lines);
    return { field, value: input.value, before: context.before.map(toLogEntry), after: context.after.map(toLogEntry) };
  }

  async exportLogs(orgId: string, input: ExportLogsInput) {
    const filter = this.filterOf(orgId, input);
    const rows: RawLogRow[] = [];
    while (rows.length < input.limit) {
      const size = Math.min(EXPORT_PAGE_SIZE, input.limit - rows.length);
      const page = await this.guarded(() =>
        this.logsRepository.queryLogs({ ...filter, limit: size, offset: rows.length }),
      );
      rows.push(...page.rows);
      if (page.rows.length < size) break;
    }
    const file = exportFile(input.format);
    return {
      body: input.format === "csv" ? toCsv(rows) : toNdjson(rows),
      contentType: file.contentType,
      filename: `logs-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.${file.extension}`,
    };
  }

  async getLogs(orgId: string, input: GetLogsInput) {
    const filter = this.filterOf(orgId, input);
    const limit = input.limit ?? 50;
    const offset = decodeOffset(input.cursor);
    const { rows, total } = await this.guarded(() =>
      this.logsRepository.queryLogs({ ...filter, limit, offset }),
    );
    return {
      data: rows.map(toLogEntry),
      nextCursor: nextOffsetCursor(offset, rows.length, limit),
      total,
    };
  }
}

function toLogEntry(row: RawLogRow) {
  return {
    id: row.id,
    timestamp: row.timestamp,
    level: row.level,
    service: row.service,
    message: row.message,
    traceId: row.traceId ?? "",
    spanId: row.spanId ?? "",
    stackTrace: row.stackTrace ?? "",
    attributes: parseAttributes(row.attributes),
  };
}
