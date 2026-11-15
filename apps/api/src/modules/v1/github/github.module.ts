import { Module } from "@nestjs/common";
import { GithubController } from "./github.controller";
import { GithubService } from "./github.service";
import { WebhookDeliveries } from "./webhook-deliveries";

@Module({
  controllers: [GithubController],
  providers: [GithubService, WebhookDeliveries],
  exports: [GithubService],
})
export class GithubModule {}
