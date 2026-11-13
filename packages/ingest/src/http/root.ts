import { Controller, Get, HttpCode, HttpStatus } from "@nestjs/common";

@Controller()
export class RootController {
  @Get()
  @HttpCode(HttpStatus.OK)
  status() {
    return {
      service: "soonwhy-ingest",
      status: "ok",
      health: "/api/health",
    };
  }
}
