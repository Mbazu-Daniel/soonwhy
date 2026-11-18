type RequestHeaders = { authorization: string } | undefined;

type OrganizationReference = { id?: string };

export type CreatedOrganization = {
  organization?: OrganizationReference;
  data?: { organization?: OrganizationReference };
  id?: string;
};

export type OrganizationAuthApi = {
  listOrganizations(input: { headers: Record<string, string> }): Promise<{ id: string }[]>;
  createOrganization(input: {
    headers: Record<string, string>;
    body: { name: string; slug: string; userId: string };
  }): Promise<CreatedOrganization>;
  addMember(input: {
    headers: RequestHeaders;
    body: { userId: string; role: string[]; organizationId: string };
  }): Promise<unknown>;
  removeMember(input: {
    headers: RequestHeaders;
    body: { memberIdOrEmail: string; organizationId: string };
  }): Promise<unknown>;
  listMembers(input: {
    headers: RequestHeaders;
    query: { organizationId: string };
  }): Promise<{ members?: unknown[] } | undefined>;
  createInvitation(input: {
    headers: RequestHeaders;
    body: { email: string; role: string; organizationId: string };
  }): Promise<unknown>;
  listInvitations(input: {
    headers: RequestHeaders;
    query: { organizationId: string };
  }): Promise<{ id: string; status?: string }[] | undefined>;
  cancelInvitation(input: {
    headers: RequestHeaders;
    body: { invitationId: string };
  }): Promise<unknown>;
  updateMemberRole(input: {
    headers: RequestHeaders;
    body: { memberId: string; role: string; organizationId: string };
  }): Promise<unknown>;
};
