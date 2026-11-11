// fallow-ignore-file unused-class-member
// NestJS consumes this LoggerService through app.useLogger() at runtime; fallow cannot see the interface dispatch.
import { ConsoleLogger, Injectable, LoggerService } from "@nestjs/common";
import { maskPiiValue } from "./pii-masker";

@Injectable()
export class PiiMaskingLogger implements LoggerService {
  private readonly logger = new ConsoleLogger();

  log(message: unknown, ...optionalParams: unknown[]): void {
    this.logger.log(maskPiiValue(message), ...optionalParams.map(maskPiiValue));
  }

  error(message: unknown, ...optionalParams: unknown[]): void {
    this.logger.error(
      maskPiiValue(message),
      ...optionalParams.map(maskPiiValue),
    );
  }

  warn(message: unknown, ...optionalParams: unknown[]): void {
    this.logger.warn(maskPiiValue(message), ...optionalParams.map(maskPiiValue));
  }

  debug(message: unknown, ...optionalParams: unknown[]): void {
    this.logger.debug(
      maskPiiValue(message),
      ...optionalParams.map(maskPiiValue),
    );
  }

  verbose(message: unknown, ...optionalParams: unknown[]): void {
    this.logger.verbose(
      maskPiiValue(message),
      ...optionalParams.map(maskPiiValue),
    );
  }
}
