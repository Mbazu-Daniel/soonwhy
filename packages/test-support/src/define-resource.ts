import type { ErasedIsolationResource, IsolationResource } from "./organization-isolation.types";

export function defineResource<Org, Ref>(resource: IsolationResource<Org, Ref>): ErasedIsolationResource<Org> {
  return resource as ErasedIsolationResource<Org>;
}
