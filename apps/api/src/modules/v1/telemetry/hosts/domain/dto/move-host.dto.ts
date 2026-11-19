import { z } from "zod";

export const MoveHostDto = z.object({
  projectId: z.string().min(1),
});

export type MoveHostInput = z.infer<typeof MoveHostDto>;
