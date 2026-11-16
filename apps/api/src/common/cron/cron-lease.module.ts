import { Global, Module } from "@nestjs/common";
import { CronLeaseService } from "./cron-lease.service";

@Global()
@Module({
  providers: [CronLeaseService],
  exports: [CronLeaseService],
})
export class CronLeaseModule {}
