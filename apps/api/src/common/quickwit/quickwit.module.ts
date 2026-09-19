import { Global, Module } from '@nestjs/common';
import { QuickwitService } from '@soonwhy/shared';

@Global()
@Module({
  providers: [QuickwitService],
  exports: [QuickwitService],
})
export class QuickwitModule {}
