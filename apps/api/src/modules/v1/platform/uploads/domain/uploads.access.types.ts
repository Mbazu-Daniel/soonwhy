export interface UploadAccessActor {
  userId: string;
  role: string;
}

export interface MemberLookup {
  findById(memberId: string): Promise<{ id: string; userId: string } | null>;
  findByUser(userId: string): Promise<{ id: string; userId: string } | null>;
}
