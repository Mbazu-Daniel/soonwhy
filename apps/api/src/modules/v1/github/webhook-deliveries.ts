import { Inject, Injectable, Logger } from "@nestjs/common";
import { Redis } from "ioredis";

const DELIVERY_TTL_SECONDS = 7 * 24 * 60 * 60;

@Injectable()
export class WebhookDeliveries {
  private readonly logger = new Logger(WebhookDeliveries.name);

  constructor(@Inject(Redis) private readonly redis: Pick<Redis, "set">) {}

  async claim(deliveryId: string): Promise<boolean> {
    try {
      const stored = await this.redis.set(
        `soonwhy:github:delivery:${deliveryId}`,
        "1",
        "EX",
        DELIVERY_TTL_SECONDS,
        "NX",
      );
      return stored === "OK";
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Could not record delivery ${deliveryId}, processing it anyway: ${reason}`);
      return true;
    }
  }
}
