import {
  Body,
  Controller,
  Delete,
  Param,
  Post,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import {
  CurrentMember,
  type MemberContext,
} from "../../../common/decorators/current-member.decorator";
import {
  CurrentUser,
  type AuthUser,
} from "../../../common/decorators/current-user.decorator";
import {
  CurrentOrg,
  type OrgContext,
} from "../../../common/decorators/current-org.decorator";
import { TenantGuard } from "../../../common/middleware/tenant-context.guard";
import {
  CreateUploadDto,
  type CreateUploadInput,
} from "./dto";
import { UploadsService } from "./uploads.service";

@UseGuards(TenantGuard)
@Controller("uploads")
export class UploadsController {
  constructor(private readonly uploads: UploadsService) {}

  @Post("upload-url")
  createUploadUrl(
    @CurrentOrg() org: OrgContext,
    @CurrentMember() member: MemberContext,
    @Body({ schema: CreateUploadDto }) body: CreateUploadInput,
  ) {
    return this.uploads.createUploadUrl(
      org.orgId,
      { userId: member.userId, role: member.role },
      body,
    );
  }

  @Post(":uploadId/confirm")
  confirmUpload(
    @CurrentOrg() org: OrgContext,
    @CurrentUser() user: AuthUser | null,
    @Param("uploadId") uploadId: string,
  ) {
    if (!user) throw new UnauthorizedException("Sign in required");
    return this.uploads.confirmUpload(org.orgId, user.id, uploadId);
  }

  @Delete(":uploadId")
  deleteUpload(
    @CurrentOrg() org: OrgContext,
    @CurrentMember() member: MemberContext,
    @Param("uploadId") uploadId: string,
  ) {
    return this.uploads.deleteUpload(
      org.orgId,
      { userId: member.userId, role: member.role },
      uploadId,
    );
  }
}
