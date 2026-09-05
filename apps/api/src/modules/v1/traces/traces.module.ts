import { Module } from '@nestjs/common';
import { TracesController } from './traces.controller';
import { TracesService } from './traces.service';
import { TracesRepository } from './traces.repository';
import { ClickhouseModule } from '../../../common/clickhouse';

@Module({
  imports: [ClickhouseModule],
  controllers: [TracesController],
  providers: [TracesService, TracesRepository],
  exports: [TracesService],
})
export class TracesModule {}
