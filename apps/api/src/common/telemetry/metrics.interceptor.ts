import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import { Observable, catchError, tap, throwError } from "rxjs";
import {
  getHttpRequestCount,
  getHttpRequestDuration,
  getHttpRequestErrors,
} from "./otel-metrics";

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    const req = context.switchToHttp().getRequest();
    const start = Date.now();
    const route = req.route?.path ?? req.path ?? "unknown";
    const method = req.method ?? "unknown";

    const labels = {
      service: "soonwhy-api",
      method,
      route,
    };

    const count = getHttpRequestCount();
    count.add(1, labels);

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - start;
        const hist = getHttpRequestDuration();
        hist.record(duration, labels);
      }),
      catchError((err) => {
        const duration = Date.now() - start;
        const hist = getHttpRequestDuration();
        hist.record(duration, labels);
        const errors = getHttpRequestErrors();
        errors.add(1, labels);
        return throwError(() => err);
      }),
    );
  }
}
