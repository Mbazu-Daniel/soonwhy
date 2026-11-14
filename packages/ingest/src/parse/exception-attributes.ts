export const EXCEPTION_STACKTRACE_KEY = "exception.stacktrace";
export const EXCEPTION_MESSAGE_KEY = "exception.message";
export const FREE_TEXT_ATTRIBUTE_KEYS: ReadonlySet<string> = new Set([
  EXCEPTION_STACKTRACE_KEY,
  EXCEPTION_MESSAGE_KEY,
]);
export const MAX_STORED_STACK_LENGTH = 32_768;
