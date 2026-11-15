import type { IncomingMessage, ServerResponse } from "http";
import { auth } from "./better-auth.config";

const BASE = "/api/auth";
const CALLBACK_PREFIX = `${BASE}/callback/`;

export function isAuthCallbackPath(url: string | undefined): boolean {
  if (!url) return false;
  const path = url.split("?")[0] ?? "";
  if (path.includes("..") || path.includes("//")) return false;
  return path.startsWith(CALLBACK_PREFIX) && path.length > CALLBACK_PREFIX.length;
}

export function fullAuthUrl(url: string): string {
  return url.startsWith(BASE) ? url : `${BASE}${url.startsWith("/") ? "" : "/"}${url}`;
}

function origin(): string {
  return new URL(process.env.BETTER_AUTH_URL || "http://localhost:8080").origin;
}

function webHeaders(req: IncomingMessage): Headers {
  const headers = new Headers();
  for (const [name, value] of Object.entries(req.headers)) {
    if (Array.isArray(value)) value.forEach((entry) => headers.append(name, entry));
    else if (value !== undefined) headers.set(name, value);
  }
  return headers;
}

async function respond(req: IncomingMessage, res: ServerResponse, url: string): Promise<void> {
  const response = await auth.handler(new Request(new URL(url, origin()), { method: "GET", headers: webHeaders(req) }));
  res.statusCode = response.status;
  response.headers.forEach((value, name) => {
    if (name.toLowerCase() !== "set-cookie") res.setHeader(name, value);
  });
  const cookies = response.headers.getSetCookie();
  if (cookies.length > 0) res.setHeader("set-cookie", cookies);
  res.end(Buffer.from(await response.arrayBuffer()));
}

export function authCallbackHandler(req: IncomingMessage, res: ServerResponse, next: () => void): void {
  const full = fullAuthUrl(req.url ?? "");
  if (req.method !== "GET" || !isAuthCallbackPath(full)) {
    next();
    return;
  }
  respond(req, res, full).catch(() => {
    res.statusCode = 500;
    res.end();
  });
}
