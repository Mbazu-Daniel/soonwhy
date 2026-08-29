export { SoonwhyClient, type SoonwhyConfig, type TelemetryEvent } from './client';

import { SoonwhyClient, type SoonwhyConfig } from './client';

export function init(config: SoonwhyConfig) {
  return new SoonwhyClient(config);
}
