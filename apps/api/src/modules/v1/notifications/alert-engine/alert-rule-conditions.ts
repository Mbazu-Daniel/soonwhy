import { z } from "zod";

const AlertRuleConditionTypeSchema = z.enum([
  "threshold",
  "rate",
  "anomaly",
  "expression",
  "lookup",
]);

const AlertRuleOperatorSchema = z.enum([
  "gt",
  "gte",
  "lt",
  "lte",
  "eq",
  "ne",
  "crosses",
  "within",
  "outside",
  "trending_up",
  "trending_down",
]);

const AlertRuleAggregationSchema = z.enum([
  "avg",
  "max",
  "min",
  "sum",
  "rate",
  "count",
]);

export const AlertRuleConditionSchema = z.object({
  type: AlertRuleConditionTypeSchema,
  metric: z.string().min(1),
  operator: AlertRuleOperatorSchema,
  value: z.union([z.number(), z.string()]).optional(),
  window: z.string().optional(),
  aggregation: AlertRuleAggregationSchema.optional(),
  negate: z.boolean().default(false),
  dependsOn: z.array(z.string()).optional(),
  description: z.string().optional(),
});
export type AlertRuleCondition = z.infer<typeof AlertRuleConditionSchema>;

