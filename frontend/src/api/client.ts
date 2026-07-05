/**
 * Finalidade: cliente HTTP do frontend (fetch) com bearer token e auto-refresh.
 * Como funciona: guarda o access token em memória; anexa Authorization; em 401 tenta
 *   um refresh (cookie httpOnly) e repete a requisição uma vez. Erros viram ApiError.
 * Relações: usado por AuthContext e pelos serviços de tela (funcionarios, ferramentas...).
 */
const BASE = "/api";

let accessToken: string | null = null;
export function setAccessToken(t: string | null): void {
  accessToken = t;
}
export function getAccessToken(): string | null {
  return accessToken;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

interface Options {
  method?: string;
  body?: unknown;
  retry?: boolean;
}

async function raw(path: string, opts: Options): Promise<Response> {
  const headers: Record<string, string> = {};
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  return fetch(`${BASE}${path}`, {
    method: opts.method ?? "GET",
    headers,
    credentials: "include",
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
}

async function refresh(): Promise<boolean> {
  const res = await fetch(`${BASE}/auth/refresh`, { method: "POST", credentials: "include" });
  if (!res.ok) return false;
  const data = (await res.json()) as { accessToken: string };
  accessToken = data.accessToken;
  return true;
}

export async function request<T>(path: string, opts: Options = {}): Promise<T> {
  let res = await raw(path, opts);
  // Tenta um refresh transparente em 401 (exceto nas próprias rotas de auth).
  if (res.status === 401 && opts.retry !== false && !path.startsWith("/auth/")) {
    if (await refresh()) res = await raw(path, { ...opts, retry: false });
  }
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    throw new ApiError(res.status, (data && data.erro) || `erro ${res.status}`);
  }
  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: "POST", body }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: "PATCH", body }),
  del: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};
