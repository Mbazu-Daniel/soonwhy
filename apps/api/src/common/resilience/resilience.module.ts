import { Global, Module } from "@nestjs/common";
import { ResilienceModule } from "@nestjs/resilience";
import { RESILIENCE_PRESETS } from "./resilience.constants";
import { OutboundHttpService } from "./outbound-http.service";

@Global()
@Module({
  imports: [ResilienceModule.forRoot({ presets: RESILIENCE_PRESETS })],
  providers: [OutboundHttpService],
  exports: [OutboundHttpService],
})
export class ResilienceConfigModule {}
