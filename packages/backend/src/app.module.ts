import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { NatsModule } from "./nats";
import { ClickhouseModule } from "./clickhouse";
import { IngestionModule } from "./modules/v1/ingestion";
import { ColdStorageModule } from "./modules/v1/cold-storage";

@Module({
  imports: [
    ScheduleModule.forRoot(),
    NatsModule,
    ClickhouseModule,
    IngestionModule,
    ColdStorageModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
