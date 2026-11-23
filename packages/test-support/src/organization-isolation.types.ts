export type IsolationOperation = "list" | "read" | "create" | "update" | "delete";

export type IsolationContext<Org, Ref> = { actor: Org; victim: Org; ref: Ref };
export type OwnerContext<Org, Ref> = { owner: Org; ref: Ref };

export type IsolationCase<Org, Ref> = {
  attempts(context: IsolationContext<Org, Ref>): Record<string, () => Promise<unknown>>;
  owner(context: OwnerContext<Org, Ref>): Promise<unknown>;
  checksResult?: boolean;
};

export type IsolationResource<Org, Ref> = {
  name: string;
  seed(organization: Org): Promise<Ref>;
  intact(ref: Ref): Promise<boolean>;
  cases: Partial<Record<IsolationOperation, IsolationCase<Org, Ref>>>;
};

export type ErasedIsolationResource<Org> = IsolationResource<Org, unknown>;

export type OrganizationIsolationSuite<Org> = {
  name: string;
  enabled: boolean;
  reset(): Promise<void>;
  close(): Promise<void>;
  createOrganization(label: string): Promise<Org>;
  resources: ReadonlyArray<ErasedIsolationResource<Org>>;
};
