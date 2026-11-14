import type { ErrorInput } from "../types.js";

export interface ErrorCaptureTarget {
  captureError(input: ErrorInput): void;
}

export interface ExpressRequestLike {
  method?: unknown;
  route?: { path?: unknown };
}

export interface FastifyRequestLike {
  method?: unknown;
  routeOptions?: { url?: unknown };
}

export type ExpressErrorHandler = (
  error: unknown,
  request: ExpressRequestLike,
  response: unknown,
  next: (error?: unknown) => void,
) => void;

export type FastifyErrorHook = (
  request: FastifyRequestLike,
  reply: unknown,
  error: unknown,
  done: () => void,
) => void;
