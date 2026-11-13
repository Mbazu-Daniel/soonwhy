import { z } from "zod";

export const MAX_IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export const CreateUploadDto = z.object({
  kind: z.enum(["user_avatar", "member_avatar", "organization_logo"]),
  targetId: z.string().trim().min(1).max(140).optional(),
  fileName: z.string().trim().min(1).max(255),
  mimeType: z.enum(MAX_IMAGE_MIME_TYPES),
  sizeBytes: z.number().int().positive().max(MAX_UPLOAD_BYTES).optional(),
});

export type CreateUploadInput = z.infer<typeof CreateUploadDto>;
