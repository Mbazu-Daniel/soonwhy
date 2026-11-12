import {
  Inject,
  Module,
  Optional,
  type DynamicModule,
  type OnApplicationShutdown,
} from "@nestjs/common";
import { initNode, type NodeSdk, type NodeSdkOptions } from "@soonwhy/node";
import { SOONWHY_SDK } from "./constants.js";

@Module({})
export class SoonwhyModule implements OnApplicationShutdown {
  static forRoot(options: NodeSdkOptions): DynamicModule {
    return {
      module: SoonwhyModule,
      global: true,
      providers: [
        { provide: SOONWHY_SDK, useFactory: () => initNode(options) },
      ],
      exports: [SOONWHY_SDK],
    };
  }

  constructor(
    @Optional() @Inject(SOONWHY_SDK) private readonly sdk?: NodeSdk,
  ) {}

  async onApplicationShutdown(): Promise<void> {
    await this.sdk?.shutdown();
  }
}
