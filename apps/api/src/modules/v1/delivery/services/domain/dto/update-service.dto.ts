import { z } from "zod";

const nullableText = (max: number) => z.string().trim().max(max).nullable().optional();

export const UpdateServiceDto = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  language: nullableText(80),
  framework: nullableText(120),
  repositoryUrl: z.string().trim().url().max(500).nullable().optional(),
  repositoryProvider: nullableText(40),
  repositoryBranch: nullableText(200),
  ownerId: z.string().min(1).nullable().optional(),
  teamId: z.string().min(1).nullable().optional(),
});

export type UpdateServiceInput = z.infer<typeof UpdateServiceDto>;
