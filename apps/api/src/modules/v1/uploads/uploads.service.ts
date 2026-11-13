import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import { db } from "../../../common/db";
import { members, organizations, uploads, users } from "../../../common/db/schema";
import {
  buildKey,
  ObjectStorageService,
} from "../../../common/storage/object-storage.service";
import { MAX_IMAGE_MIME_TYPES, MAX_UPLOAD_BYTES, type CreateUploadInput } from "./dto";
import {
  assertSizeAndType,
  resolveUploadTarget,
  type UploadAccessActor,
} from "./uploads.access";

@Injectable()
export class UploadsService {
  constructor(private readonly storage: ObjectStorageService) {}

  private memberLookup(orgId: string) {
    return {
      findById: (memberId: string) =>
        db
          .select({ id: members.id, userId: members.userId })
          .from(members)
          .where(and(eq(members.id, memberId), eq(members.organizationId, orgId)))
          .limit(1)
          .then((rows) => rows[0] ?? null),
      findByUser: (userId: string) =>
        db
          .select({ id: members.id, userId: members.userId })
          .from(members)
          .where(and(eq(members.userId, userId), eq(members.organizationId, orgId)))
          .limit(1)
          .then((rows) => rows[0] ?? null),
    };
  }

  async createUploadUrl(
    orgId: string,
    actor: UploadAccessActor,
    input: CreateUploadInput,
  ) {
    const targetId = await resolveUploadTarget(
      input.kind,
      orgId,
      actor,
      input.targetId,
      this.memberLookup(orgId),
    );

    const key = buildKey(input.kind, targetId, input.fileName);
    const ttlSeconds = this.storage.getUploadUrlTtlSeconds();
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

    const uploadUrl = await this.storage.presignUploadUrl(
      key,
      input.mimeType,
      input.sizeBytes,
    );

    const [upload] = await db
      .insert(uploads)
      .values({
        kind: input.kind,
        organizationId: orgId,
        targetId,
        key,
        fileName: input.fileName,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes ?? null,
        status: "PENDING",
        uploadExpiresAt: expiresAt,
        createdBy: actor.userId,
      })
      .returning();

    if (!upload) {
      throw new InternalServerErrorException("failed to create upload record");
    }

    return {
      uploadId: upload.id,
      uploadUrl,
      key: upload.key,
      expiresAt: expiresAt.toISOString(),
      maxBytes: MAX_UPLOAD_BYTES,
      allowedMimeTypes: [...MAX_IMAGE_MIME_TYPES],
    };
  }

  async confirmUpload(orgId: string, actorId: string, uploadId: string) {
    const [upload] = await db
      .select()
      .from(uploads)
      .where(and(eq(uploads.id, uploadId), eq(uploads.organizationId, orgId)))
      .limit(1);

    if (!upload) throw new NotFoundException("Upload not found");
    if (upload.createdBy !== actorId) {
      throw new ForbiddenException("Only the uploader can confirm this upload");
    }
    if (upload.status === "READY") {
      return { upload, fileUrl: this.storage.publicUrl(upload.key) };
    }

    const meta = await this.storage.headObject(upload.key);
    if (!meta) {
      await db
        .update(uploads)
        .set({ status: "FAILED" })
        .where(eq(uploads.id, upload.id));
      throw new BadRequestException("the image has not been uploaded");
    }

    const mismatch = assertSizeAndType(
      { sizeBytes: upload.sizeBytes, mimeType: upload.mimeType },
      { sizeBytes: meta.sizeBytes, contentType: meta.contentType },
    );
    if (mismatch) {
      await db
        .update(uploads)
        .set({ status: "FAILED" })
        .where(eq(uploads.id, upload.id));
      throw new BadRequestException(mismatch);
    }

    const [ready] = await db
      .update(uploads)
      .set({ status: "READY", sizeBytes: meta.sizeBytes, uploadExpiresAt: null })
      .where(eq(uploads.id, upload.id))
      .returning();

    if (!ready) {
      throw new InternalServerErrorException("failed to mark upload ready");
    }

    const fileUrl = this.storage.publicUrl(ready.key);
    switch (ready.kind) {
      case "user_avatar":
        await db
          .update(users)
          .set({ image: fileUrl, updatedAt: new Date() })
          .where(eq(users.id, ready.targetId));
        break;
      case "member_avatar":
        await db
          .update(members)
          .set({ avatar: fileUrl })
          .where(
            and(
              eq(members.id, ready.targetId),
              eq(members.organizationId, orgId),
            ),
          );
        break;
      case "organization_logo":
        await db
          .update(organizations)
          .set({ logo: fileUrl, updatedAt: new Date() })
          .where(eq(organizations.id, orgId));
        break;
    }

    return { upload: ready, fileUrl };
  }

  async deleteUpload(
    orgId: string,
    actor: UploadAccessActor,
    uploadId: string,
  ) {
    const [upload] = await db
      .select()
      .from(uploads)
      .where(and(eq(uploads.id, uploadId), eq(uploads.organizationId, orgId)))
      .limit(1);

    if (!upload) throw new NotFoundException("Upload not found");
    const isAdmin = actor.role === "owner" || actor.role === "admin";
    if (upload.createdBy !== actor.userId && !isAdmin) {
      throw new ForbiddenException(
        "Only the uploader or an admin can delete this upload",
      );
    }

    await this.storage.deleteObject(upload.key);
    await db.delete(uploads).where(eq(uploads.id, upload.id));
    return { deleted: true };
  }
}
