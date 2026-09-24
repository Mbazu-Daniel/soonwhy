import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { db } from '../../../common/db';

@Controller('health')
export class HealthController {
  private ok() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Get()
  check() {
    return this.ok();
  }

  @Get('live')
  live() {
    return this.ok();
  }

  @Get('ready')
  async ready() {
    try {
      await db.execute(sql`select 1`);
      return { ...this.ok(), dependencies: { database: 'ok' } };
    } catch {
      throw new ServiceUnavailableException({
        status: 'degraded',
        timestamp: new Date().toISOString(),
        dependencies: { database: 'unavailable' },
      });
    }
  }
}
