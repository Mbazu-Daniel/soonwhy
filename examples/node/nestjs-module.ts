import "reflect-metadata";
import { Controller, Get, Inject, Module } from "@nestjs/common";
import { SOONWHY_SDK, type NodeSdk } from "@soonwhy/nest";
import { NestFactory } from "@nestjs/core";
import { SoonwhyModule } from "@soonwhy/nest";

const apiKey = process.env.SOONWHY_API_KEY;
if (!apiKey) throw new Error("SOONWHY_API_KEY is required");

@Controller()
class ExampleController {
  @Get("/health")
  health() {
    return { ok: true };
  }

  @Get("/failure")
  failure(): never {
    throw new Error("4C NestJS module example failure");
  }

  @Get("/sdk-status")
  sdkStatus() {
    return { started: this.soonwhy.isStarted(), stats: this.soonwhy.getStats() };
  }

  constructor(@Inject(SOONWHY_SDK) private readonly soonwhy: NodeSdk) {}
}

@Module({
  imports: [
    SoonwhyModule.forRoot({
      apiKey,
      endpoint: process.env.SOONWHY_ENDPOINT,
      serviceName: "soonwhy-example-nestjs-module",
      environment: "4c-validation",
    }),
  ],
  controllers: [ExampleController],
})
class ExampleModule {}

const app = await NestFactory.create(ExampleModule, { logger: false });
await app.listen(3001);

console.log("NestJS SoonwhyModule example listening on http://localhost:3001");
