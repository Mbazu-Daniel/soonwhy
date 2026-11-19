import { JsMsg } from "nats";

export type NatsServiceOptions = {
  required?: boolean;
};

export type NatsMessageHandler = (msg: JsMsg) => Promise<void>;

export type NatsSubscriptionSnapshot = {
  subject: string;
  durable: string;
  active: boolean;
  processed: number;
  failed: number;
  lastError: string | undefined;
};

export type NatsConsumerSnapshot = {
  subject: string;
  durable: string;
  pending: number;
  ackPending: number;
  redelivered: number;
};
