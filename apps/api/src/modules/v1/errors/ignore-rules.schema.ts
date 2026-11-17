import { z } from "zod";
import { IGNORE_PATTERN_ANY_PATH, IGNORE_PATTERN_MAX_LENGTH } from "./ignore-rules.constants";

export const IgnoreRuleSchema = z.object({
  pathPattern: z
    .string()
    .trim()
    .min(2)
    .max(IGNORE_PATTERN_MAX_LENGTH)
    .refine((value) => value.startsWith("/"), "The path must start with /")
    .refine((value) => !IGNORE_PATTERN_ANY_PATH.test(value), "A rule cannot match every path"),
  status: z
    .string()
    .trim()
    .regex(/^[1-5]\d\d$/, "Use a three-digit status such as 404")
    .nullish()
    .transform((value) => value ?? null),
});

export type IgnoreRuleInput = z.output<typeof IgnoreRuleSchema>;
