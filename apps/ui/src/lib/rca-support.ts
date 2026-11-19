const RCA_SUPPORTED_TYPES: readonly string[] = ['bottleneck', 'error_group'];

export function isRcaSupported(type: string | undefined): boolean {
  return type !== undefined && RCA_SUPPORTED_TYPES.includes(type);
}
