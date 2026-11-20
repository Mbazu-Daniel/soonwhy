import { z } from "zod";

export const ErrorStatusSchema = z
  .object({ status: z.enum(["unresolved", "resolved", "ignored"]) })
  .strict();
