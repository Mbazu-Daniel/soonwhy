import { Module } from "@nestjs/common";
import { QueryCatalogController } from "./query-catalog.controller";
import { QueryCatalogService } from "./query-catalog.service";

@Module({
  controllers: [QueryCatalogController],
  providers: [QueryCatalogService],
  exports: [QueryCatalogService],
})
export class QueryCatalogModule {}
