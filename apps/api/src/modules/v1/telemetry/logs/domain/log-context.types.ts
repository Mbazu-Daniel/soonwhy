import type { RawLogRow } from "./logs.repository.types";

export interface LogContext {
  before: RawLogRow[];
  after: RawLogRow[];
}
