export { Client, initNode, shutdown } from './client.js';
export {
  DEFAULT_ENDPOINT,
  DEFAULT_TIMEOUT_MS,
  resolveNodeOptions,
  type ResolvedNodeSdkOptions,
} from './config.js';
export { hasSupportedInstrumentation } from './instrumentation.js';
export type { NodeSampling, NodeSdk, NodeSdkOptions } from './types.js';
