export class PayloadTooLargeError extends Error {
  constructor() {
    super("OTLP payload is too large");
    this.name = "PayloadTooLargeError";
  }
}
