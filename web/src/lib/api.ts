// Единая точка запросов к бэку. В браузере — через rewrite Next (/api/...), на сервере — прямой API_URL.
const BASE = typeof window === "undefined" ? (process.env.API_URL ?? "http://127.0.0.1:8010") : "";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

function cookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : null;
}

let csrfPending: Promise<unknown> | null = null;
async function csrfToken(): Promise<string | null> {
  let token = cookie("csrftoken");
  if (!token) {
    csrfPending ??= fetch(`${BASE}/api/auth/csrf/`, { credentials: "include" }).finally(() => (csrfPending = null));
    await csrfPending;
    token = cookie("csrftoken");
  }
  return token;
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const method = (init.method ?? "GET").toUpperCase();
  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (method !== "GET" && typeof window !== "undefined") {
    const token = await csrfToken();
    if (token) headers.set("X-CSRFToken", token);
  }
  const res = await fetch(`${BASE}/api${path}`, { ...init, method, headers, credentials: "include" });
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error ?? `HTTP ${res.status}`);
  return data as T;
}

export const post = <T>(path: string, body?: unknown) =>
  api<T>(path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) });
