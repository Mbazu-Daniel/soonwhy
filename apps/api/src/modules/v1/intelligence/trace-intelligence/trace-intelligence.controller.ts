import { Controller, Post, Body } from "@nestjs/common";
import { TraceIntelligenceService } from "./trace-intelligence.service";
import type { Trace, CriticalPathAnalysis, TraceFinding } from "./trace-intelligence.types";

@Controller("intelligence/trace")
export class TraceIntelligenceController {
  constructor(private readonly traceService: TraceIntelligenceService) {}

  @Post("analyze-critical-path")
  analyzeCriticalPath(@Body() trace: Trace): CriticalPathAnalysis {
    return this.traceService.analyzeCriticalPath(trace);
  }

  @Post("compare")
  compareTraces(@Body() body: { before: Trace; after: Trace }) {
    return this.traceService.compareTraces(body.before, body.after);
  }

  @Post("findings")
  generateFindings(@Body() analysis: CriticalPathAnalysis): TraceFinding[] {
    return this.traceService.generateFindings(analysis);
  }
}
