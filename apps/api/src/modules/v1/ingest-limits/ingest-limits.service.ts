import { Injectable, Logger } from "@nestjs/common";
import { IngestLimitsRepository } from "./ingest-limits.repository";

@Injectable()
export class IngestLimitsService {
  private readonly logger = new Logger(IngestLimitsService.name);

  constructor(private readonly repository: IngestLimitsRepository) {}

  async getIngestLimits(orgId: string, projectId: string) {
    const limits = await this.repository.getIngestLimits(orgId, projectId);
    
    // Return defaults if no limits configured
    return limits || {
      maxEventsPerSecond: 1000,
      backpressureEnabled: true,
      backpressureStrategy: 'drop',
      sampleRate: 100,
      traceSampleRate: 100,
      metricSampleRate: 100,
      logSampleRate: 100,
      serviceSamplingConfig: {},
      alertOnLimitExceeded: true,
    };
  }

  async createOrUpdateIngestLimits(data: {
    orgId: string;
    projectId: string;
    maxEventsPerSecond?: number;
    maxBytesPerSecond?: number;
    backpressureEnabled?: boolean;
    backpressureStrategy?: string;
    sampleRate?: number;
    traceSampleRate?: number;
    metricSampleRate?: number;
    logSampleRate?: number;
    serviceSamplingConfig?: Record<string, unknown>;
    alertOnLimitExceeded?: boolean;
  }) {
    return this.repository.createOrUpdateIngestLimits(data);
  }

  async shouldAcceptTelemetry(
    orgId: string,
    projectId: string,
    currentEventsPerSecond: number,
    signalType?: 'trace' | 'metric' | 'log',
    serviceName?: string,
  ): Promise<{ accept: boolean; reason?: string }> {
    const limits = await this.getIngestLimits(orgId, projectId);

    if (!limits.backpressureEnabled) {
      return { accept: true };
    }

    // Check rate limit
    if (currentEventsPerSecond > limits.maxEventsPerSecond) {
      const strategy = limits.backpressureStrategy || 'drop';
      
      if (strategy === 'drop') {
        this.logger.warn(
          `Dropping telemetry for ${orgId}/${projectId}: rate limit exceeded (${currentEventsPerSecond} > ${limits.maxEventsPerSecond})`,
        );
        return { accept: false, reason: 'rate_limit_exceeded' };
      }
      
      if (strategy === 'sample') {
        const sampleRate = limits.sampleRate || 100;
        const shouldSample = Math.random() * 100 < sampleRate;
        
        if (!shouldSample) {
          return { accept: false, reason: 'sampled' };
        }
      }
    }

    // Check signal-type sampling
    if (signalType) {
      let signalSampleRate = 100;
      
      // Use per-signal-type rate if configured
      if (signalType === 'trace' && limits.traceSampleRate !== undefined) {
        signalSampleRate = limits.traceSampleRate;
      } else if (signalType === 'metric' && limits.metricSampleRate !== undefined) {
        signalSampleRate = limits.metricSampleRate;
      } else if (signalType === 'log' && limits.logSampleRate !== undefined) {
        signalSampleRate = limits.logSampleRate;
      }

      // Check service-specific override
      if (serviceName && limits.serviceSamplingConfig) {
        const serviceConfig = (limits.serviceSamplingConfig as Record<string, Record<string, number>>)[serviceName];
        if (serviceConfig && serviceConfig[signalType + 's'] !== undefined) {
          signalSampleRate = serviceConfig[signalType + 's'] || signalSampleRate;
        }
      }

      if (signalSampleRate < 100) {
        const shouldSample = Math.random() * 100 < signalSampleRate;
        if (!shouldSample) {
          return { accept: false, reason: 'signal_sampled' };
        }
      }
    }

    return { accept: true };
  }
}
