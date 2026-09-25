import { Injectable } from '@nestjs/common';

export type ConcurrencySnapshot = {
  limit: number;
  perOrganizationLimit: number;
  inFlight: number;
  available: number;
  saturated: boolean;
  organizations: number;
};

@Injectable()
export class IngestConcurrency {
  private readonly limit: number;
  private readonly perOrganizationLimit: number;
  private inFlight = 0;
  private readonly organizationInFlight = new Map<string, number>();

  constructor() {
    const configured = Number(process.env.INGEST_MAX_CONCURRENCY || 100);
    this.limit = Number.isInteger(configured) && configured > 0 ? configured : 100;
    const configuredPerOrganization = Number(
      process.env.INGEST_MAX_CONCURRENCY_PER_ORG || Math.max(1, Math.floor(this.limit / 4)),
    );
    this.perOrganizationLimit =
      Number.isInteger(configuredPerOrganization) && configuredPerOrganization > 0
        ? Math.min(configuredPerOrganization, this.limit)
        : Math.max(1, Math.floor(this.limit / 4));
  }

  tryAcquire(organizationId: string): boolean {
    const organizationInFlight = this.organizationInFlight.get(organizationId) ?? 0;
    if (this.inFlight >= this.limit || organizationInFlight >= this.perOrganizationLimit) return false;
    this.inFlight += 1;
    this.organizationInFlight.set(organizationId, organizationInFlight + 1);
    return true;
  }

  release(organizationId: string): void {
    if (this.inFlight > 0) this.inFlight -= 1;
    const organizationInFlight = this.organizationInFlight.get(organizationId) ?? 0;
    if (organizationInFlight <= 1) this.organizationInFlight.delete(organizationId);
    else this.organizationInFlight.set(organizationId, organizationInFlight - 1);
  }

  snapshot(): ConcurrencySnapshot {
    return {
      limit: this.limit,
      perOrganizationLimit: this.perOrganizationLimit,
      inFlight: this.inFlight,
      available: Math.max(0, this.limit - this.inFlight),
      saturated: this.inFlight >= this.limit,
      organizations: this.organizationInFlight.size,
    };
  }
}
