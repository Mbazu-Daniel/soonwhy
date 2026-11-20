import { z } from "zod";

export const getOperationsSchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

type GetOperationsInput = z.infer<typeof getOperationsSchema>;
