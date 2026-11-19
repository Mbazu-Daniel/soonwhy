import { Module } from "@nestjs/common";
import { NatsService } from "@soonwhy/shared";
import { DlqController } from "./presentation/dlq.controller";
import { DlqService } from "./application/dlq.service";
import { DlqRepository } from "./infrastructure/dlq.repository";

@Module({
  controllers: [DlqController],
  providers: [
    DlqService,
    DlqRepository,
    {
      provide: NatsService,
      useValue: new NatsService(),
    },
  ],
  exports: [DlqService],
})
export class DlqModule {}
