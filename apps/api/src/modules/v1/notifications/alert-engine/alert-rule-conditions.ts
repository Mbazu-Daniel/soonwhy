import { z } from "zod";

export const AlertRuleConditionTypeSchema = z.enum([
  "threshold",
  "rate",
  "anomaly",
  "expression",
  "lookup",
]);
export type AlertRuleConditionType = z.infer<
  typeof AlertRuleConditionTypeSchema
>;

export const AlertRuleOperatorSchema = z.enum([
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
export type AlertRuleOperator = z.infer<typeof AlertRuleOperatorSchema>;

export const AlertRuleAggregationSchema = z.enum([
  "avg",
  "max",
  "min",
  "sum",
  "rate",
  "count",
]);
export type AlertRuleAggregation = z.infer<typeof AlertRuleAggregationSchema>;

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

export const AlertRuleConditionGroupSchema = z.object({
  type: z.enum(["AND", "OR", "NOT"]),
  conditions: z.array(AlertRuleConditionSchema),
  precedence: z.number().default(0),
});
export type AlertRuleConditionGroup = z.infer<
  typeof AlertRuleConditionGroupSchema
>;
