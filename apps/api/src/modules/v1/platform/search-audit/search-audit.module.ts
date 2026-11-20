import { Global, Module } from "@nestjs/common";
import { SearchAuditController } from "./presentation/search-audit.controller";
import { SearchAuditInterceptor } from "./application/search-audit.interceptor";
import { SearchAuditRepository } from "./infrastructure/search-audit.repository";
import { SearchAuditService } from "./application/search-audit.service";

@Global()
@Module({
  controllers: [SearchAuditController],
  providers: [SearchAuditRepository, SearchAuditService, SearchAuditInterceptor],
  exports: [SearchAuditService, SearchAuditInterceptor],
})
export class SearchAuditModule {}
