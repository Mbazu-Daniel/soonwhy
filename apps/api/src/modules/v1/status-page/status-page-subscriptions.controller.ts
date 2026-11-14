import { Controller, Post, Get, Delete, Body, Param } from "@nestjs/common";
import { StatusPageSubscriptionsRepository } from "./status-page-subscriptions.repository";

@Controller("public/status/:orgId/:projectId/subscriptions")
export class StatusPageSubscriptionsController {
  constructor(private readonly repository: StatusPageSubscriptionsRepository) {}

  @Post()
  async subscribe(
    @Param("orgId") orgId: string,
    @Param("projectId") projectId: string,
    @Body() body: { email: string; slackWebhookUrl?: string },
  ) {
    const existing = await this.repository.getByEmail(orgId, projectId, body.email);
    if (existing) {
      return { message: "Already subscribed", subscription: existing };
    }

    return this.repository.createSubscription(orgId, projectId, body);
  }

  @Get()
  async getSubscriptions(
    @Param("orgId") orgId: string,
    @Param("projectId") projectId: string,
  ) {
    return this.repository.getSubscriptions(orgId, projectId);
  }

  @Delete(":subscriptionId")
  async unsubscribe(@Param("subscriptionId") subscriptionId: string) {
    await this.repository.unsubscribe(subscriptionId);
    return { message: "Unsubscribed successfully" };
  }
}
