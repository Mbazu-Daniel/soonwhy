import { z } from "zod";
import { assertPublicHttpUrlSyntax } from "./public-address";

export const publicHttpUrl = z
  .string()
  .url()
  .max(2048)
  .superRefine((value, ctx) => {
    try {
      assertPublicHttpUrlSyntax(value);
    } catch (error) {
      ctx.addIssue({ code: "custom", message: error instanceof Error ? error.message : "Unsafe URL" });
    }
  });
