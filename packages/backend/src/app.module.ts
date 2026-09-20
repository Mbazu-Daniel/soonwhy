import { Module } from "@nestjs/common";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { NatsModule } from "./nats";
import { ClickhouseModule } from "./clickhouse";
import { IngestionModule } from "./modules/v1/ingestion";

@Module({
  imports: [NatsModule, ClickhouseModule, IngestionModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
