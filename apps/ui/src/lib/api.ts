import { API_BASE, API_PREFIX } from "./config";

/** The API's error envelope (RFC 9457 plus a stable `code` and a user-facing `hint`). */
export interface ApiProblem {
  code?: string;
  title?: string;
  detail?: string;
  hint?: string;
}

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public problem: ApiProblem = {},
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function apiProblem(error: unknown): ApiProblem {
  return error instanceof ApiError ? error.problem : {};
}

const UNSCOPED_PREFIXES = ["/auth", "/organizations", "/health", "/marketing", "/admin"];

function scopePath(path: string, orgId: string | null): string {
  const pathname = path.split("?")[0] ?? path;
  const unscoped = UNSCOPED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
  if (unscoped || pathname.startsWith("/organization/")) return path;
  if (!orgId) throw new ApiError(400, "Choose an organization first");
  return `/organization/${encodeURIComponent(orgId)}${path.startsWith("/") ? path : `/${path}`}`;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const orgId =
    typeof window !== "undefined" ? localStorage.getItem("org_id") : null;
  const url = `${API_BASE}${API_PREFIX}${scopePath(path, orgId)}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("session_token")
      : null;
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  if (orgId) {
    headers["X-Org-Id"] = orgId;
  }

  const res = await fetch(url, { ...options, headers });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: res.statusText }));

    if (res.status === 401 && typeof window !== "undefined") {
      localStorage.removeItem("session_token");
      localStorage.removeItem("org_id");
      localStorage.removeItem("org_slug");
      localStorage.removeItem("project_id");
      localStorage.setItem(
        "soonwhy:return-path",
        window.location.pathname + window.location.search,
      );
      const path = window.location.pathname;
      if (path !== "/login" && path !== "/register")
        window.location.assign("/login");
    }

    throw new ApiError(
      res.status,
      body.detail || body.message || body.title || "Request failed",
      {
        code: body.code,
        title: body.title,
        detail: body.detail,
        hint: body.hint,
      },
    );
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: "POST",
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    }),
  put: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "PUT", body: JSON.stringify(body) }),
  delete: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: "DELETE",
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    }),
};
