import { Injectable } from "@nestjs/common";
import { StatusPageSubscriptionsRepository } from "../infrastructure/status-page-subscriptions.repository";
import { type SubscribeToStatusPageInput } from "../domain/status-page-subscription.dto";

@Injectable()
export class StatusPageSubscriptionsService {
  constructor(private readonly repository: StatusPageSubscriptionsRepository) {}

  async subscribe(orgId: string, projectId: string, input: SubscribeToStatusPageInput) {
    const existing = await this.repository.getByEmail(orgId, projectId, input.email);
    if (existing) return { message: "Already subscribed" };
    return this.repository.createSubscription(orgId, projectId, input);
  }

  async unsubscribe(orgId: string, projectId: string, subscriptionId: string) {
    await this.repository.unsubscribe(orgId, projectId, subscriptionId);
    return { message: "Unsubscribed successfully" };
  }
}
