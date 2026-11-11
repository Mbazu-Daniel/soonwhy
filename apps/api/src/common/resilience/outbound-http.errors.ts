export class OutboundHttpError extends Error {
  readonly statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.name = "OutboundHttpError";
    this.statusCode = statusCode;
  }
}
