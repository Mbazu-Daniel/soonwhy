import { z } from "zod/v4";

export const signInSchema = z
  .object({
    email: z.email(),
    password: z.string().min(8),
  })
  .meta({ id: "SignInInput" });

export const signUpSchema = z
  .object({
    email: z.email(),
    password: z.string().min(8),
  })
  .meta({ id: "SignUpInput" });

export type SignInInput = z.infer<typeof signInSchema>;
export type SignUpInput = z.infer<typeof signUpSchema>;
