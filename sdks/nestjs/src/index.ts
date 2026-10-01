import {
  DynamicModule,
  Global,
  Inject,
  Module,
  OnApplicationShutdown,
} from '@nestjs/common';
import { initNode, type NodeSdk, type NodeSdkOptions } from '@soonwhy/node';

export const SOONWHY_SDK = Symbol('SOONWHY_SDK');

export type NestjsSdkOptions = NodeSdkOptions;

@Global()
@Module({})
export class SoonwhyModule implements OnApplicationShutdown {
  constructor(@Inject(SOONWHY_SDK) private readonly sdk: NodeSdk) {}

  static forRoot(options: NestjsSdkOptions): DynamicModule {
    return {
      module: SoonwhyModule,
      providers: [
        {
          provide: SOONWHY_SDK,
          useFactory: () =>
            initNode({
              ...options,
              registerShutdownHandlers: false,
              instrumentations: {
                ...options.instrumentations,
                nestjs: true,
                express: true,
                http: true,
              },
            }),
        },
      ],
      exports: [SOONWHY_SDK],
      global: true,
    };
  }

  getClient(): NodeSdk {
    return this.sdk;
  }

  async onApplicationShutdown(): Promise<void> {
    await this.sdk.shutdown();
  }
}
