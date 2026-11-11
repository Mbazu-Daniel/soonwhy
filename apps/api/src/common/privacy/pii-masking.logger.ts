import { ConsoleLogger, Injectable, LoggerService, LogLevel } from "@nestjs/common";
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

  fatal(message: unknown, ...optionalParams: unknown[]): void {
    this.logger.fatal(
      maskPiiValue(message),
      ...optionalParams.map(maskPiiValue),
    );
  }

  setLogLevels(levels: LogLevel[]): void {
    this.logger.setLogLevels(levels);
  }
}
