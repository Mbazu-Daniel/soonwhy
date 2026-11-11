import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  CurrentOrg,
  OrgContext,
} from "../../../common/decorators/current-org.decorator";
import { TenantGuard } from "../../../common/middleware/tenant-context.guard";
import { QueryCatalogService } from "./query-catalog.service";

@Controller("projects/:projectId/query-catalog")
@UseGuards(TenantGuard)
export class QueryCatalogController {
  constructor(private readonly service: QueryCatalogService) {}

  @Get("schema")
  async getSchema(
    @CurrentOrg() org: OrgContext,
    @Param("projectId") projectId: string,
    @Query("dataType") dataType?: string,
  ) {
    return this.service.getSchema(org.orgId, projectId, dataType);
  }

  @Post("schema/field")
  async updateSchemaField(
    @CurrentOrg() org: OrgContext,
    @Param("projectId") projectId: string,
    @Body() body: {
      dataType: string;
      fieldName: string;
      fieldType: string;
      values?: unknown[];
    },
  ) {
    await this.service.updateSchemaField(
      org.orgId,
      projectId,
      body.dataType,
      body.fieldName,
      body.fieldType,
      body.values,
    );
    return { message: "Schema field updated" };
  }

  @Post("saved-queries")
  async saveQuery(
    @CurrentOrg() org: OrgContext,
    @Param("projectId") projectId: string,
    @Body() body: {
      name: string;
      description?: string;
      dataType: string;
      query: Record<string, unknown>;
    },
  ) {
    return this.service.saveQuery(
      org.orgId,
      projectId,
      body.name,
      body.description,
      body.dataType,
      body.query,
    );
  }

  @Get("saved-queries")
  async getSavedQueries(
    @CurrentOrg() org: OrgContext,
    @Param("projectId") projectId: string,
    @Query("dataType") dataType?: string,
  ) {
    return this.service.getSavedQueries(org.orgId, projectId, dataType);
  }

  @Delete("saved-queries/:id")
  async deleteSavedQuery(@Param("id") id: string) {
    await this.service.deleteSavedQuery(id);
    return { message: "Deleted" };
  }
}
