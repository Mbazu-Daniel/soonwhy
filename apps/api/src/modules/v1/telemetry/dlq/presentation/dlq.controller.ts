import {
  Controller,
  Get,
  UseGuards,
  Post,
  Delete,
  Param,
  Query,
  Body,
  Req,
} from "@nestjs/common";
import { PlatformAdminGuard, SuperAdminGuard } from "../../../../../common/guards/platform-admin.guard";
import type { TenantRequest } from "../../../../../common/middleware/tenant-context.middleware.types";
import { DlqService } from "../application/dlq.service";
import { parseEntryId } from "../domain/dlq.validation";

@UseGuards(PlatformAdminGuard)
@Controller("admin/dlq")
export class DlqController {
  constructor(private readonly service: DlqService) {}

  @Get()
  async getDlqEntries(
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
  ) {
    return this.service.getDlqEntries(
      limit ? Number(limit) : 100,
      offset ? Number(offset) : 0,
    );
  }

  @Get("stats")
  async getDlqStats() {
    return this.service.getDlqStats();
  }

  @Get(":id")
  async getDlqEntry(@Param("id") id: string) {
    return this.service.getDlqEntryById(parseEntryId(id));
  }

  @UseGuards(SuperAdminGuard)
  @Post(":id/replay")
  async replayDlqEntry(@Param("id") id: string, @Req() req: TenantRequest, @Body() body?: { force?: boolean }) {
    return this.service.replayDlqEntry(parseEntryId(id), req.user!.id, body?.force === true);
  }

  @UseGuards(SuperAdminGuard)
  @Post("bulk-replay")
  async bulkReplay(@Body() body: { ids: number[] }, @Req() req: TenantRequest) {
    return this.service.bulkReplay(body?.ids, req.user!.id);
  }

  @UseGuards(SuperAdminGuard)
  @Delete("bulk-delete")
  async bulkDelete(@Body() body: { ids: number[] }) {
    return this.service.bulkDelete(body?.ids);
  }

  @UseGuards(SuperAdminGuard)
  @Delete(":id")
  async deleteDlqEntry(@Param("id") id: string) {
    await this.service.deleteDlqEntry(parseEntryId(id));
    return { message: "Deleted" };
  }

  @Get(":id/attempts")
  async getReplayAttempts(@Param("id") id: string) {
    return this.service.getReplayAttempts(parseEntryId(id));
  }

  @Get(":id/export")
  async exportDlqEntry(@Param("id") id: string) {
    return this.service.exportDlqEntry(parseEntryId(id));
  }

  @UseGuards(SuperAdminGuard)
  @Post("cleanup")
  async cleanupOldEntries(@Body() body: { daysOld?: number }) {
    const { deleted } = await this.service.cleanupOldEntries(body?.daysOld);
    return { message: "Cleanup completed", deleted };
  }
}
