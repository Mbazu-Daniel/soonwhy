export type ResiliencePresetName = "webhook" | "slack" | "email" | "probe";

export interface OutboundRequestInput {
  url: string;
  preset: ResiliencePresetName;
  source: string;
  init?: RequestInit;
}
