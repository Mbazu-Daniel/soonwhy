import { Controller, Get, UseGuards } from "@nestjs/common";
import {
  CurrentMember,
  type MemberContext,
} from "../../../common/decorators/current-member.decorator";
import { TenantGuard } from "../../../common/middleware/tenant-context.guard";

@Controller("member-context")
@UseGuards(TenantGuard)
export class MemberContextController {
  @Get()
  me(@CurrentMember() member: MemberContext) {
    return { role: member?.role ?? "member", orgId: member?.orgId ?? null };
  }
}
