import { Global, Module } from "@nestjs/common";
import { SearchAuditController } from "./search-audit.controller";
import { SearchAuditInterceptor } from "./search-audit.interceptor";
import { SearchAuditRepository } from "./search-audit.repository";
import { SearchAuditService } from "./search-audit.service";

@Global()
@Module({
  controllers: [SearchAuditController],
  providers: [SearchAuditRepository, SearchAuditService, SearchAuditInterceptor],
  exports: [SearchAuditService, SearchAuditInterceptor],
})
export class SearchAuditModule {}
