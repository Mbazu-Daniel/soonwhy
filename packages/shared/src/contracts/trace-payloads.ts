export type PayloadSide = "request" | "response";

export type PayloadIssueKind = "large" | "sensitive_field" | "unbounded_list" | "deep_nesting";

export type PayloadIssue = { kind: PayloadIssueKind; side: PayloadSide; message: string; path?: string };

export type PayloadReport = {
  spanId: string;
  operation: string;
  side: PayloadSide;
  bytes: number;
  format: "json" | "text";
  fieldCount: number;
  issues: PayloadIssue[];
};
