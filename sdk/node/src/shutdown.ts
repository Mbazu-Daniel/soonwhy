export class ShutdownHandlers {
  private readonly handlers: Array<() => void> = [];

  register(onSignal: (signal: "SIGINT" | "SIGTERM") => void): void {
    for (const signal of ["SIGINT", "SIGTERM"] as const) {
      const handler = () => onSignal(signal);
      process.once(signal, handler);
      this.handlers.push(() => process.removeListener(signal, handler));
    }
  }

  removeAll(): void {
    for (const remove of this.handlers.splice(0)) remove();
  }
}
