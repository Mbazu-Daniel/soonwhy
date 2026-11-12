import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  type Cipheriv,
  type Decipheriv,
} from "node:crypto";

type GcmSivCipher = Cipheriv & { getAuthTag(): Buffer };
type GcmSivDecipher = Decipheriv & { setAuthTag(tag: Buffer): void };

const PII_KEY_PATTERN =
  /(?<![a-z0-9])(email|e_?mail|mailaddr|phone|mobile|e164|fax|address|addr|street|city|zip|postal|country|credit(?:card|cardnum)|card[-_]?number|cardnumber|card[-_]?holder|cardholder|ccn|cardnum|pan|ssn|social|national[-_ ]?id|tax[-_ ]?id|passport|dob|dateofbirth|birthdate|birth|gender|first[-_ ]?name|last[-_ ]?name|surname|middle[-_ ]?name|full[-_ ]?name|fname|lname)(?![a-z0-9])/i;

const PII_VALUE_PATTERNS = [
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
  /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g,
  /(?:\d[ -]?){12,18}\d/g,
  /\b\d{3}-\d{2}-\d{4}\b/g,
  /\+\d[\d\s().-]{7,}\d/g,
  /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
];

const PREFIX = "pii:v1:";
const TAG_BYTES = 16;

let cachedKey: Buffer | undefined;

function loadKey(): Buffer {
  if (cachedKey) return cachedKey;
  const raw = process.env.SOONWHY_PII_ENCRYPTION_KEY;
  if (raw && /^[0-9a-fA-F]{64}$/.test(raw.trim())) {
    cachedKey = Buffer.from(raw.trim(), "hex");
    return cachedKey;
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "SOONWHY_PII_ENCRYPTION_KEY must be a 64-character hex string in production",
    );
  }
  cachedKey = randomBytes(32);
  return cachedKey;
}

export function isPiiKey(key: string | undefined): boolean {
  return key ? PII_KEY_PATTERN.test(key) : false;
}

export function isPiiValue(value: string | undefined): boolean {
  if (!value) return false;
  return PII_VALUE_PATTERNS.some((pattern) => {
    pattern.lastIndex = 0;
    return pattern.test(value);
  });
}

export function isPiiAttribute(key: string, value: unknown): boolean {
  if (isPiiKey(key)) return true;
  return typeof value === "string" && isPiiValue(value);
}

export function encryptPii(plaintext: string): string {
  if (plaintext.startsWith(PREFIX)) return plaintext;
  const key = loadKey();
  const iv = createHmac("sha256", key).update(plaintext).digest().subarray(0, 12);
  const cipher = createCipheriv("aes-256-gcm-siv", key, iv) as GcmSivCipher;
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${Buffer.concat([iv, tag, ciphertext]).toString("base64url")}`;
}

export function decryptPii(payload: string): string {
  if (!payload.startsWith(PREFIX)) return payload;
  const key = loadKey();
  const raw = Buffer.from(payload.slice(PREFIX.length), "base64url");
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 12 + TAG_BYTES);
  const ciphertext = raw.subarray(12 + TAG_BYTES);
  const decipher = createDecipheriv(
    "aes-256-gcm-siv",
    key,
    iv,
  ) as GcmSivDecipher;
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

export function encryptPiiInText(text: string): string {
  if (!text) return text;
  let result = text;
  for (const pattern of PII_VALUE_PATTERNS) {
    pattern.lastIndex = 0;
    result = result.replace(pattern, (match) => encryptPii(match));
  }
  return result;
}
