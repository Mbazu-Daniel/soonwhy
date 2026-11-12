import { isIP } from "node:net";
import dns from "node:dns/promises";

const IPV4_BLOCKED: Array<[number, number]> = [
  [0x00000000, 0xff000000],
  [0x0a000000, 0xff000000],
  [0x64400000, 0xffc00000],
  [0x7f000000, 0xff000000],
  [0xa9fe0000, 0xffff0000],
  [0xac100000, 0xfff00000],
  [0xc0000000, 0xffffff00],
  [0xc0000200, 0xffffff00],
  [0xc0a80000, 0xffff0000],
  [0xc6120000, 0xfffe0000],
  [0xc6336400, 0xffffff00],
  [0xcb007100, 0xffffff00],
  [0xe0000000, 0xf0000000],
  [0xffffffff, 0xffffffff],
];

function parseIpv4(address: string): number | null {
  const parts = address.split(".");
  if (parts.length !== 4) return null;
  let value = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const n = Number(part);
    if (n > 255) return null;
    value = value * 256 + n;
  }
  return value >>> 0;
}

function parseIpv6Groups(address: string): string[] | null {
  const input = address.toLowerCase();
  const doubleColon = input.split("::");
  if (doubleColon.length > 2) return null;
  if (doubleColon.length === 2) {
    const left = doubleColon[0] ? doubleColon[0].split(":") : [];
    const right = doubleColon[1] ? doubleColon[1].split(":") : [];
    const missing = 8 - left.length - right.length;
    if (missing < 0) return null;
    return [...left, ...Array(missing).fill("0"), ...right];
  }
  const groups = input.split(":");
  return groups.length === 8 ? groups : null;
}

function parseIpv4MappedV6(address: string): string | null {
  const match = address.match(/::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
  if (match) return match[1]!;
  const expanded = address.match(/(?:^|:)0*:0*:0*:0*:0*:ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
  return expanded ? expanded[1]! : null;
}

export function isPublicIpAddress(rawAddress: string): boolean {
  const address = rawAddress.replace(/^\[|\]$/g, "");
  const v4 = parseIpv4(address);
  if (v4 !== null) {
    return !IPV4_BLOCKED.some(([net, mask]) => ((v4 & mask) >>> 0) === net);
  }
  const mapped = parseIpv4MappedV6(address.toLowerCase());
  if (mapped) return isPublicIpAddress(mapped);
  const groups = parseIpv6Groups(address);
  if (!groups) return false;
  const first = Number.parseInt(groups[0] ?? "0", 16);
  if (Number.isNaN(first)) return false;
  if ((first & 0xe000) !== 0x2000) return false;
  const second = Number.parseInt(groups[1] ?? "0", 16);
  if (first === 0x2001 && second === 0x0db8) return false;
  return true;
}

export async function assertPublicDns(hostname: string): Promise<void> {
  if (isIP(hostname)) {
    if (!isPublicIpAddress(hostname)) {
      throw new Error(`Private or reserved address: ${hostname}`);
    }
    return;
  }
  let addresses: Array<{ address: string; family: number }>;
  try {
    addresses = await dns.lookup(hostname, { all: true, verbatim: true });
  } catch {
    throw new Error(`DNS resolution failed for ${hostname}`);
  }
  if (addresses.length === 0) {
    throw new Error(`DNS resolution returned no addresses for ${hostname}`);
  }
  for (const entry of addresses) {
    if (!isPublicIpAddress(entry.address)) {
      throw new Error(
        `Private or reserved address ${entry.address} resolved for ${hostname}`,
      );
    }
  }
}
