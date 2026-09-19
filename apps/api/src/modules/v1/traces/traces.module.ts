import { Module } from '@nestjs/common';
import { TracesController } from './traces.controller';
import { TracesService } from './traces.service';
import { TracesRepository } from './traces.repository';

@Module({
  controllers: [TracesController],
  providers: [TracesService, TracesRepository],
  exports: [TracesService],
})
export class TracesModule {}
