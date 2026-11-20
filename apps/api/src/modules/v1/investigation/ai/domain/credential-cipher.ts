import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "crypto";
import { Logger } from "@nestjs/common";
import { aiEncryptionUnavailable, CredentialDecryptError } from "./ai.errors";

const KEY_ENV = "SOONWHY_PII_ENCRYPTION_KEY";
const IV_BYTES = 12;

export class CredentialCipher {
  private static readonly logger = new Logger(CredentialCipher.name);
  private static warnedUnavailable = false;

  private constructor(private readonly key: Buffer | null) {}

  static fromEnv(env: NodeJS.ProcessEnv = process.env): CredentialCipher {
    const raw = env[KEY_ENV];
    if (!raw) return new CredentialCipher(null);

    const key = Buffer.from(raw, "hex");
    if (!/^[0-9a-fA-F]{64}$/.test(raw) || key.length !== 32) {
      CredentialCipher.logger.error(
        `${KEY_ENV} must be 64 hexadecimal characters (32 bytes); AI credential storage is disabled`,
      );
      return new CredentialCipher(null);
    }

    return new CredentialCipher(key);
  }

  get available(): boolean {
    return this.key !== null;
  }

  get keyFingerprint(): string {
    if (!this.key) return "none";
    return createHash("sha256").update(this.key).digest("hex").slice(0, 8);
  }

  encrypt(value: string): string {
    const key = this.requireKey();
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    const data = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
    return [
      iv.toString("base64"),
      cipher.getAuthTag().toString("base64"),
      data.toString("base64"),
    ].join(":");
  }

  decrypt(payload: string): string {
    const key = this.requireKey();
    const parts = payload.split(":");
    if (parts.length !== 3 || parts.some((part) => part.length === 0)) {
      throw new CredentialDecryptError();
    }

    const [iv, authTag, data] = parts as [string, string, string];
    try {
      const decipher = createDecipheriv(
        "aes-256-gcm",
        key,
        Buffer.from(iv, "base64"),
      );
      decipher.setAuthTag(Buffer.from(authTag, "base64"));
      return Buffer.concat([
        decipher.update(Buffer.from(data, "base64")),
        decipher.final(),
      ]).toString("utf8");
    } catch {
      throw new CredentialDecryptError();
    }
  }

  private requireKey(): Buffer {
    if (this.key) return this.key;

    if (!CredentialCipher.warnedUnavailable) {
      CredentialCipher.warnedUnavailable = true;
      CredentialCipher.logger.warn(
        `${KEY_ENV} is not configured; bring-your-own-key AI credentials are unavailable`,
      );
    }
    throw aiEncryptionUnavailable();
  }
}
