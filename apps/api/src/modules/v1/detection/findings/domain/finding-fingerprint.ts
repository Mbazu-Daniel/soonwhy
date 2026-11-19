export function findingFingerprint(type: string, serviceName: string, identity?: string): string {
  return [type, serviceName, identity ?? ""].join(":");
}
