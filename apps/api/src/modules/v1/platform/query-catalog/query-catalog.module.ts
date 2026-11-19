import { Module } from "@nestjs/common";
import { QueryCatalogController } from "./presentation/query-catalog.controller";
import { QueryCatalogService } from "./application/query-catalog.service";

@Module({
  controllers: [QueryCatalogController],
  providers: [QueryCatalogService],
  exports: [QueryCatalogService],
})
export class QueryCatalogModule {}
