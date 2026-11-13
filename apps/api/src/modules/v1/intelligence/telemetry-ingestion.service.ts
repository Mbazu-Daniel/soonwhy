import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { connect, NatsConnection } from "nats";
import { requiredEnvInProduction } from "@soonwhy/shared";

@Injectable()
export class TelemetryIngestionService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TelemetryIngestionService.name);
  private connection: NatsConnection | null = null;

  constructor() {}

  async onModuleInit(): Promise<void> {
    const servers = requiredEnvInProduction("NATS_URL", "nats://localhost:4222");
    try {
      this.connection = await connect({ servers, reconnect: true });
      this.logger.log(`Connected to NATS at ${servers}`);

      // Subscribe to telemetry subjects
      const sub = this.connection.subscribe("telemetry.>", {
        queue: "intelligence-processor",
      });

      (async () => {
        for await (const msg of sub) {
          try {
            const data = JSON.parse(msg.data.toString());
            await this.processTelemetry(data);
          } catch (error) {
            this.logger.error(`Failed to process telemetry message: ${error}`);
          }
        }
      })();

      this.logger.log('Telemetry ingestion service initialized');
    } catch (error) {
      this.logger.error(`Failed to initialize NATS connection: ${error}`);
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.connection) {
      await this.connection.close();
      this.logger.log('NATS connection closed');
    }
  }

  private async processTelemetry(data: unknown): Promise<void> {
    this.logger.debug(`Processing telemetry: ${JSON.stringify(data)}`);
    // TODO: Route to appropriate intelligence modules
  }
}
