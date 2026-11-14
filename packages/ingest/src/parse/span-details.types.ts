export interface SpanDetailSanitizers {
  attributes: (attributes: Record<string, unknown>) => Record<string, string>;
  text: (value: string) => string;
}

export interface SpanEventRow {
  name: string;
  timestamp: string;
  attributes: Record<string, string>;
}

export interface SpanLinkRow {
  traceId: string;
  spanId: string;
  attributes: Record<string, string>;
}

export interface SpanExceptionFields {
  exceptionType?: string;
  exceptionMessage?: string;
  exceptionStacktrace?: string;
}

export interface SpanDetailFields extends SpanExceptionFields {
  attributes: Record<string, string>;
  resourceAttributes: Record<string, string>;
  events: SpanEventRow[];
  links: SpanLinkRow[];
}
