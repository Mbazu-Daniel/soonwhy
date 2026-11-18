import dns from "node:dns";
import { isPublicIpAddress } from "./public-address";

export function pinnedLookup(
  hostname: string,
  options: dns.LookupOptions,
  callback: (
    error: NodeJS.ErrnoException | null,
    address: string | dns.LookupAddress[],
    family?: number,
  ) => void,
): void {
  dns.lookup(hostname, { all: true, verbatim: true }, (error, addresses) => {
    if (error) {
      callback(error as NodeJS.ErrnoException, "", undefined);
      return;
    }
    if (addresses.length === 0) {
      callback(new Error(`DNS resolution failed for ${hostname}`), "", undefined);
      return;
    }
    for (const entry of addresses) {
      if (!isPublicIpAddress(entry.address)) {
        callback(
          new Error(
            `Private or reserved address ${entry.address} resolved for ${hostname}`,
          ),
          "",
          undefined,
        );
        return;
      }
    }
    if (options?.all) {
      callback(null, addresses);
      return;
    }
    const first = addresses[0]!;
    callback(null, first.address, first.family);
  });
}
