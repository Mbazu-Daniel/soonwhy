import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import { GithubService } from "../application/github.service";
import { WEBHOOK_PATH_PREFIX } from "../domain/github.constants";
import { TenantGuard } from "../../../../../common/middleware/tenant-context.guard";

@UseGuards(TenantGuard)
@Controller("projects/:projectId/github")
export class GithubSetupController {
  constructor(private readonly githubService: GithubService) {}

  @Get("webhook")
  webhook(@Param("projectId") projectId: string) {
    return {
      path: `${WEBHOOK_PATH_PREFIX}/${projectId}`,
      secret: this.githubService.secretForProject(projectId),
      event: "push",
      contentType: "application/json",
    };
  }
}
