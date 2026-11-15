import { CallHandler, ExecutionContext, Injectable, NestInterceptor, SetMetadata } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Observable } from "rxjs";
import type { TenantRequest } from "../../../common/middleware/tenant-context.middleware";
import { SEARCH_AUDIT_ACTION, type SearchAction } from "./search-audit.constants";
import { SearchAuditService } from "./search-audit.service";

export const AuditSearch = (action: SearchAction) => SetMetadata(SEARCH_AUDIT_ACTION, action);

@Injectable()
export class SearchAuditInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly audit: SearchAuditService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const action = this.reflector.get<SearchAction | undefined>(SEARCH_AUDIT_ACTION, context.getHandler());
    if (action) this.audit.record(context.switchToHttp().getRequest<TenantRequest>(), action);
    return next.handle();
  }
}
