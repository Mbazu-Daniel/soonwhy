import { Controller, Get } from '@nestjs/common';

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
  ready() {
    return this.ok();
  }
}
