import { randomInt } from "node:crypto";
import { PUBLIC_ID_LENGTH } from "./public-id.constants";

const ALPHABET =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

export function generatePublicId(): string {
  let id = "";
  for (let i = 0; i < PUBLIC_ID_LENGTH; i++) {
    id += ALPHABET[randomInt(0, ALPHABET.length)];
  }
  return id;
}

export function isPublicIdCollision(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string" &&
    error.message.includes("public_id")
  );
}
