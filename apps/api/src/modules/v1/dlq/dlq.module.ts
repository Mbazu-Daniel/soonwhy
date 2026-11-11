import { Module } from "@nestjs/common";
import { NatsService } from "@soonwhy/shared";
import { DlqController } from "./dlq.controller";
import { DlqService } from "./dlq.service";
import { DlqRepository } from "./dlq.repository";

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
