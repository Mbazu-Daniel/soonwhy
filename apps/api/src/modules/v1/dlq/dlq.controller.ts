import {
  Controller,
  Get,
  UseGuards,
  Post,
  Delete,
  Param,
  Query,
  Body,
} from "@nestjs/common";
import { PlatformAdminGuard, SuperAdminGuard } from "../../../common/guards/platform-admin.guard";
import { DlqService } from "./dlq.service";

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
    return this.service.getDlqEntryById(Number(id));
  }


  @UseGuards(SuperAdminGuard)
  @Post(":id/replay")
  async replayDlqEntry(@Param("id") id: string) {
    return this.service.replayDlqEntry(Number(id));
  }

  @UseGuards(SuperAdminGuard)
  @Post("bulk-replay")
  async bulkReplay(@Body() body: { ids: number[] }) {
    return this.service.bulkReplay(body.ids);
  }

  @UseGuards(SuperAdminGuard)
  @Delete(":id")
  async deleteDlqEntry(@Param("id") id: string) {
    await this.service.deleteDlqEntry(Number(id));
    return { message: "Deleted" };
  }

  @UseGuards(SuperAdminGuard)
  @Delete("bulk-delete")
  async bulkDelete(@Body() body: { ids: number[] }) {
    await this.service.bulkDelete(body.ids);
    return { message: "Deleted" };
  }

  @Get(":id/export")
  async exportDlqEntry(@Param("id") id: string) {
    return this.service.exportDlqEntry(Number(id));
  }

  @UseGuards(SuperAdminGuard)
  @Post("cleanup")
  async cleanupOldEntries(@Body() body: { daysOld?: number }) {
    await this.service.cleanupOldEntries(body.daysOld || 7);
    return { message: "Cleanup completed" };
  }
}
