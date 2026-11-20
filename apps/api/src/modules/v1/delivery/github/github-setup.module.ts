import { Module } from "@nestjs/common";
import { GithubService } from "./application/github.service";
import { GithubSetupController } from "./presentation/github-setup.controller";

@Module({
  controllers: [GithubSetupController],
  providers: [GithubService],
})
export class GithubSetupModule {}
