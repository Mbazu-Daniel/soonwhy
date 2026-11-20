import { z } from "zod";
import { FINDING_CATEGORIES } from "../../../../../common/db/schema/finding-lifecycle";
import { AlertRuleConditionSchema } from "../../alert-engine/alert-rule-conditions";

export const CreateAlertRuleDto = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  conditions: z.array(AlertRuleConditionSchema).min(1),
  minSeverity: z.enum(["critical", "high", "medium", "low"]),
  channelIds: z.array(z.string()).default([]),
  dedupeWindowSeconds: z.number().int().positive().default(300),
  findingCategory: z.enum(FINDING_CATEGORIES).nullable().optional(),
});
export type CreateAlertRuleInput = z.infer<typeof CreateAlertRuleDto>;

export const UpdateAlertRuleDto = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional(),
  conditions: z.array(AlertRuleConditionSchema).optional(),
  minSeverity: z.enum(["critical", "high", "medium", "low"]).optional(),
  channelIds: z.array(z.string()).optional(),
  status: z.enum(["active", "disabled"]).optional(),
  dedupeWindowSeconds: z.number().int().positive().optional(),
  findingCategory: z.enum(FINDING_CATEGORIES).nullable().optional(),
});
export type UpdateAlertRuleInput = z.infer<typeof UpdateAlertRuleDto>;
