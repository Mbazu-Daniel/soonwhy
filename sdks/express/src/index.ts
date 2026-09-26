import { initNode, type NodeSdk, type NodeSdkOptions } from '@soonwhy/node';

export type ExpressSdkOptions = NodeSdkOptions;

export function initExpress(options: ExpressSdkOptions): NodeSdk {
  return initNode({
    ...options,
    instrumentations: {
      ...options.instrumentations,
      express: true,
      http: true,
    },
  });
}
