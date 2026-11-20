import { type AlertRuleSeverity } from "../../../../common/db/schema";

export type DispatchInput = {
  orgId: string;
  projectId: string;
  incidentId: string;
  severity: AlertRuleSeverity;
  title: string;
  body: string;
  htmlBody?: string;
  metadata?: Record<string, string>;
};

export type DispatchResult = { sent: number; failed: number; results: { channelId: string; channelType: string; ok: boolean; error?: string }[] };
