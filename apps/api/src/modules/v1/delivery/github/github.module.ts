import { Module } from "@nestjs/common";
import { GithubController } from "./presentation/github.controller";
import { GithubService } from "./application/github.service";

@Module({
  controllers: [GithubController],
  providers: [GithubService],
  exports: [GithubService],
})
export class GithubModule {}
