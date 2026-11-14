export type UncaughtErrorSink = (error: unknown, kind: "uncaughtException" | "unhandledRejection") => void;

export class UncaughtErrorHandlers {
  private readonly removers: Array<() => void> = [];

  register(sink: UncaughtErrorSink): void {
    const onException = (error: Error) => sink(error, "uncaughtException");
    const onRejection = (reason: unknown) => sink(reason, "unhandledRejection");
    process.on("uncaughtExceptionMonitor", onException);
    process.on("unhandledRejection", onRejection);
    this.removers.push(
      () => process.removeListener("uncaughtExceptionMonitor", onException),
      () => process.removeListener("unhandledRejection", onRejection),
    );
  }

  removeAll(): void {
    for (const remove of this.removers.splice(0)) remove();
  }
}
