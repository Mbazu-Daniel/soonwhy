import { HttpException } from "@nestjs/common";
import { MIN_CAPTURED_STATUS } from "./capture.constants.js";

export function shouldCapture(exception: unknown): boolean {
  if (exception instanceof HttpException) return exception.getStatus() >= MIN_CAPTURED_STATUS;
  return true;
}
