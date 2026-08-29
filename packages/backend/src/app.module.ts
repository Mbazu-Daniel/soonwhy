import { Module } from "@nestjs/common";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { NatsModule } from "./nats";
import { ClickhouseModule } from "./clickhouse";

@Module({
  imports: [NatsModule, ClickhouseModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
