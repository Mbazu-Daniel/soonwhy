export type UncaughtErrorSink = (error: unknown, kind: "uncaughtException" | "unhandledRejection") => void;
