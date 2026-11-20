import type { PackageRef } from "./vulnerability.types";

export function parsePackageRef(reference: string): PackageRef | null {
  const at = reference.lastIndexOf("@");
  if (at <= 0) return null;
  return { name: reference.slice(0, at), version: reference.slice(at + 1) };
}

export function uniquePackages(references: string[]): PackageRef[] {
  const seen = new Map<string, PackageRef>();
  for (const reference of references) {
    const pkg = parsePackageRef(reference);
    if (pkg) seen.set(`${pkg.name}@${pkg.version}`, pkg);
  }
  return [...seen.values()];
}
