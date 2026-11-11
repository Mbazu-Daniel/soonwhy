import { Controller, Get, Req } from "@nestjs/common";
import type { TenantRequest } from "../../../common/middleware/tenant-context.middleware";
import { platformRoleFor } from "../../../common/guards/platform-admin.guard";

@Controller("admin")
export class PlatformAdminController {
  @Get("me")
  async me(@Req() req: TenantRequest) {
    return { platformRole: await platformRoleFor(req?.user?.id) };
  }
}
