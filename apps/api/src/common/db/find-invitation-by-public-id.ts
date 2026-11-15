import { eq } from "drizzle-orm";
import { db } from "./index";
import { invitations } from "./schema";

export async function findInvitationByPublicId(publicId: string) {
  const [row] = await db
    .select({ id: invitations.id, organizationId: invitations.organizationId })
    .from(invitations)
    .where(eq(invitations.publicId, publicId))
    .limit(1);
  return row;
}
