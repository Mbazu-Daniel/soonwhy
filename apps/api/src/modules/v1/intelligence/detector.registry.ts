export interface Detector<Input = unknown, Output = unknown> {
  readonly type: string;
  run(input: Input): Output | Promise<Output>;
}

export class DetectorRegistry {
  private readonly detectors = new Map<string, Detector>();

  register<Input = unknown, Output = unknown>(
    detector: Detector<Input, Output>,
  ): void {
    this.detectors.set(detector.type, detector);
  }

  get<Input = unknown, Output = unknown>(
    type: string,
  ): Detector<Input, Output> | undefined {
    return this.detectors.get(type) as Detector<Input, Output> | undefined;
  }

  async run<Input = unknown, Output = unknown>(
    type: string,
    input: Input,
  ): Promise<Output | undefined> {
    const detector = this.get<Input, Output>(type);
    if (!detector) return undefined;
    return detector.run(input);
  }

  async runAll(): Promise<[string, unknown][]> {
    const results: [string, unknown][] = [];
    for (const [type, detector] of this.detectors) {
      try {
        results.push([type, await detector.run(undefined as any)]);
      } catch {
        results.push([type, undefined]);
      }
    }
    return results;
  }

  get types(): string[] {
    return Array.from(this.detectors.keys());
  }
}

export const detectorRegistry = new DetectorRegistry();

export function registerDetector<Input = unknown, Output = unknown>(
  detector: Detector<Input, Output>,
): void {
  detectorRegistry.register(detector);
}
