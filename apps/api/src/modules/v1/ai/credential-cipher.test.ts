import { describe, expect, it } from "vitest";
import { createCipheriv, randomBytes } from "crypto";
import { CredentialCipher } from "./credential-cipher";
import { CredentialDecryptError } from "./ai.errors";

const KEY = "a".repeat(64);
const KEY_B = "b".repeat(64);

function legacyEncrypt(value: string, hexKey = KEY): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", Buffer.from(hexKey, "hex"), iv);
  const data = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return [
    iv.toString("base64"),
    cipher.getAuthTag().toString("base64"),
    data.toString("base64"),
  ].join(":");
}

describe("CredentialCipher", () => {
  it("round-trips a provider key", () => {
    const cipher = CredentialCipher.fromEnv({
      SOONWHY_CREDENTIAL_ENCRYPTION_KEY: KEY,
    });
    const apiKey = "gsk_secret_value_123";

    expect(cipher.available).toBe(true);
    expect(cipher.decrypt(cipher.encrypt(apiKey))).toBe(apiKey);
  });

  it("decrypts credentials written by the previous implementation", () => {
    const cipher = CredentialCipher.fromEnv({
      SOONWHY_CREDENTIAL_ENCRYPTION_KEY: KEY,
    });

    expect(cipher.decrypt(legacyEncrypt("sk-legacy-key"))).toBe(
      "sk-legacy-key",
    );
  });

  it("produces a different ciphertext per call", () => {
    const cipher = CredentialCipher.fromEnv({
      SOONWHY_CREDENTIAL_ENCRYPTION_KEY: KEY,
    });

    expect(cipher.encrypt("same-key")).not.toBe(cipher.encrypt("same-key"));
  });

  it("rejects a tampered auth tag", () => {
    const cipher = CredentialCipher.fromEnv({
      SOONWHY_CREDENTIAL_ENCRYPTION_KEY: KEY,
    });
    const [iv, , data] = cipher.encrypt("sk-secret").split(":");
    const forged = `${iv}:${Buffer.from(randomBytes(16)).toString("base64")}:${data}`;

    expect(() => cipher.decrypt(forged)).toThrow(CredentialDecryptError);
  });

  it("rejects a credential encrypted under another key", () => {
    const cipher = CredentialCipher.fromEnv({
      SOONWHY_CREDENTIAL_ENCRYPTION_KEY: KEY,
    });

    expect(() => cipher.decrypt(legacyEncrypt("sk-secret", KEY_B))).toThrow(
      CredentialDecryptError,
    );
  });

  it.each([
    "no-separator",
    "only:two",
    "::::",
    ":AAAAAAAAAAAAAAAAAAAAAAAA:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=:AAAA",
    "AAAAAAAAAAAAAAAAAAAAAAAA:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=:",
  ])("rejects the malformed payload %s", (payload) => {
    const cipher = CredentialCipher.fromEnv({
      SOONWHY_CREDENTIAL_ENCRYPTION_KEY: KEY,
    });

    expect(() => cipher.decrypt(payload)).toThrow(CredentialDecryptError);
  });

  it("names decryption failures so callers can map them to a 503", () => {
    const cipher = CredentialCipher.fromEnv({
      SOONWHY_CREDENTIAL_ENCRYPTION_KEY: KEY,
    });

    try {
      cipher.decrypt("malformed");
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(CredentialDecryptError);
      expect((error as Error).message).not.toContain("sk-");
    }
  });

  it.each([
    ["missing", ""],
    ["short", "a".repeat(63)],
    ["non-hexadecimal", "z".repeat(64)],
    ["utf-8 secret", "correct-horse-battery-staple"],
  ])("disables storage when the configured key is %s", (_label, value) => {
    const cipher = CredentialCipher.fromEnv({
      SOONWHY_CREDENTIAL_ENCRYPTION_KEY: value,
    });
    const bare = CredentialCipher.fromEnv({});

    expect(cipher.available).toBe(false);
    expect(cipher.keyFingerprint).toBe("none");
    expect(bare.available).toBe(false);
    expect(() => cipher.encrypt("sk-secret")).toThrow(
      expect.objectContaining({
        message: expect.any(String),
      }),
    );
  });

  it("reports encryption unavailability as a 503 with a stable code", () => {
    const cipher = CredentialCipher.fromEnv({});

    try {
      cipher.encrypt("sk-secret");
      expect.unreachable();
    } catch (error) {
      expect((error as { getStatus: () => number }).getStatus()).toBe(503);
      expect(
        (error as { getResponse: () => { code: string } }).getResponse().code,
      ).toBe("AI_CREDENTIAL_ENCRYPTION_UNAVAILABLE");
    }
  });

  it("fingerprints the key so rotation busts cached handles", () => {
    const a = CredentialCipher.fromEnv({
      SOONWHY_CREDENTIAL_ENCRYPTION_KEY: KEY,
    });
    const b = CredentialCipher.fromEnv({
      SOONWHY_CREDENTIAL_ENCRYPTION_KEY: KEY,
    });
    const other = CredentialCipher.fromEnv({
      SOONWHY_CREDENTIAL_ENCRYPTION_KEY: KEY_B,
    });

    expect(a.keyFingerprint).toHaveLength(8);
    expect(b.keyFingerprint).toBe(a.keyFingerprint);
    expect(other.keyFingerprint).not.toBe(a.keyFingerprint);
  });
});
