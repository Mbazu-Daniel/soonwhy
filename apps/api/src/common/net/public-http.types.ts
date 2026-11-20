import { pinnedLookup } from "./pinned-lookup";

export interface PublicHttpRequest {
  url: string;
  method?: string;
  headers?: HeadersInit;
  body?: unknown;
  signal?: AbortSignal;
  lookup?: typeof pinnedLookup;
}
