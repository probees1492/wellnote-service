// Lightweight typed API client with token-refresh interceptor.

// Default to same-origin so Next.js rewrites proxy to the backend (avoids
// browser CORS in local dev). Override with NEXT_PUBLIC_API_BASE_URL when the
// backend is exposed cross-origin (and supports CORS).
const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  (typeof window !== "undefined" ? window.location.origin : "http://localhost:3000");

export interface Tokens {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: string;
  refreshTokenExpiresAt: string;
}

export interface ApiUser {
  id: string;
  email: string;
  displayName: string;
  role: "user" | "admin" | "superadmin";
  creditBalance: number;
  isSuspended: boolean;
  emailVerifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApiError extends Error {
  status: number;
  code?: string;
}

const ACCESS_KEY = "wn:access";
const REFRESH_KEY = "wn:refresh";
const USER_KEY = "wn:user";
const MODE_KEY = "wn:mode";

export type StorageMode = "persistent" | "session";

function getModeFromStorage(): StorageMode {
  if (typeof window === "undefined") return "persistent";
  // sessionStorage takes precedence: a session-only login should win even if
  // older persistent values linger.
  try {
    const fromSession = window.sessionStorage.getItem(MODE_KEY);
    if (fromSession === "session" || fromSession === "persistent") {
      return fromSession;
    }
  } catch {
    /* ignore */
  }
  try {
    const fromLocal = window.localStorage.getItem(MODE_KEY);
    if (fromLocal === "session" || fromLocal === "persistent") {
      return fromLocal;
    }
  } catch {
    /* ignore */
  }
  return "persistent";
}

function activeStorage(mode: StorageMode): Storage | null {
  if (typeof window === "undefined") return null;
  return mode === "session" ? window.sessionStorage : window.localStorage;
}

function bothStorages(): Storage[] {
  if (typeof window === "undefined") return [];
  return [window.localStorage, window.sessionStorage];
}

export const tokenStore = {
  getMode(): StorageMode {
    return getModeFromStorage();
  },
  setMode(mode: StorageMode): void {
    if (typeof window === "undefined") return;
    // Record the active mode in BOTH storages so a fresh page load can detect
    // it even before any read. We prefer sessionStorage on read.
    try {
      window.sessionStorage.setItem(MODE_KEY, mode);
    } catch {
      /* ignore */
    }
    try {
      window.localStorage.setItem(MODE_KEY, mode);
    } catch {
      /* ignore */
    }
  },
  getAccess(): string | null {
    if (typeof window === "undefined") return null;
    const mode = getModeFromStorage();
    const s = activeStorage(mode);
    if (!s) return null;
    // Fall back to the other storage if the active one is empty (e.g., mode
    // changed but a previous run wrote to localStorage only).
    return (
      s.getItem(ACCESS_KEY) ??
      (mode === "session"
        ? window.localStorage.getItem(ACCESS_KEY)
        : window.sessionStorage.getItem(ACCESS_KEY))
    );
  },
  getRefresh(): string | null {
    if (typeof window === "undefined") return null;
    const mode = getModeFromStorage();
    const s = activeStorage(mode);
    if (!s) return null;
    return (
      s.getItem(REFRESH_KEY) ??
      (mode === "session"
        ? window.localStorage.getItem(REFRESH_KEY)
        : window.sessionStorage.getItem(REFRESH_KEY))
    );
  },
  getUser(): ApiUser | null {
    if (typeof window === "undefined") return null;
    const mode = getModeFromStorage();
    const s = activeStorage(mode);
    const raw =
      (s ? s.getItem(USER_KEY) : null) ??
      (mode === "session"
        ? window.localStorage.getItem(USER_KEY)
        : window.sessionStorage.getItem(USER_KEY));
    if (!raw) return null;
    try {
      return JSON.parse(raw) as ApiUser;
    } catch {
      return null;
    }
  },
  set(tokens: Tokens, user?: ApiUser): void {
    if (typeof window === "undefined") return;
    const mode = getModeFromStorage();
    const s = activeStorage(mode);
    if (!s) return;
    // Clear the OTHER storage so we don't leak credentials between modes.
    const other =
      mode === "session" ? window.localStorage : window.sessionStorage;
    try {
      other.removeItem(ACCESS_KEY);
      other.removeItem(REFRESH_KEY);
      other.removeItem(USER_KEY);
    } catch {
      /* ignore */
    }
    s.setItem(ACCESS_KEY, tokens.accessToken);
    s.setItem(REFRESH_KEY, tokens.refreshToken);
    if (user) s.setItem(USER_KEY, JSON.stringify(user));
  },
  setUser(user: ApiUser): void {
    if (typeof window === "undefined") return;
    const mode = getModeFromStorage();
    const s = activeStorage(mode);
    if (!s) return;
    s.setItem(USER_KEY, JSON.stringify(user));
  },
  clear(): void {
    if (typeof window === "undefined") return;
    for (const s of bothStorages()) {
      try {
        s.removeItem(ACCESS_KEY);
        s.removeItem(REFRESH_KEY);
        s.removeItem(USER_KEY);
      } catch {
        /* ignore */
      }
    }
    // Mode key is intentionally preserved so the user's preference survives
    // a logout. Reset to "persistent" only on explicit choice.
  },
};

interface RequestOpts {
  method?: string;
  body?: unknown;
  auth?: boolean;
  signal?: AbortSignal;
  query?: Record<string, string | number | undefined>;
}

function buildUrl(path: string, query?: RequestOpts["query"]): string {
  const url = new URL(path, API_BASE);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null) {
        url.searchParams.set(k, String(v));
      }
    }
  }
  return url.toString();
}

async function tryRefresh(): Promise<Tokens | null> {
  const refresh = tokenStore.getRefresh();
  if (!refresh) return null;
  const res = await fetch(buildUrl("/auth/refresh"), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ refreshToken: refresh }),
  });
  if (!res.ok) return null;
  const j = (await res.json()) as { tokens: Tokens };
  const t = j.tokens;
  tokenStore.set(t);
  return t;
}

export async function request<T = unknown>(
  path: string,
  opts: RequestOpts = {},
): Promise<T> {
  const url = buildUrl(path, opts.query);
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  if (opts.auth !== false) {
    const tok = tokenStore.getAccess();
    if (tok) headers.authorization = `Bearer ${tok}`;
  }
  const init: RequestInit = {
    method: opts.method ?? "GET",
    headers,
    signal: opts.signal,
  };
  if (opts.body !== undefined) {
    init.body = JSON.stringify(opts.body);
  }
  let res = await fetch(url, init);
  // Refresh on 401 once.
  if (res.status === 401 && opts.auth !== false) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      headers.authorization = `Bearer ${refreshed.accessToken}`;
      res = await fetch(url, { ...init, headers });
    }
  }
  let payload: any = null;
  const ct = res.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) {
    payload = await res.json().catch(() => null);
  } else {
    payload = await res.text().catch(() => "");
  }
  if (!res.ok) {
    const err = new Error(
      (payload?.error?.message as string) ||
        (typeof payload === "string" && payload) ||
        `Request failed (${res.status})`,
    ) as ApiError;
    err.status = res.status;
    err.code = payload?.error?.code;
    throw err;
  }
  return payload as T;
}

// ---------- Typed endpoints ----------

export const api = {
  base: API_BASE,
  signup: (body: { email: string; password: string; displayName?: string }) =>
    request<{ user: ApiUser; tokens: Tokens }>("/auth/signup", {
      method: "POST",
      body,
      auth: false,
    }),
  login: (body: { email: string; password: string }) =>
    request<{ user: ApiUser; tokens: Tokens }>("/auth/login", {
      method: "POST",
      body,
      auth: false,
    }),
  socialGoogle: (body: { idToken: string }) =>
    request<{ user: ApiUser; tokens: Tokens }>("/auth/social/google", {
      method: "POST",
      body,
      auth: false,
    }),
  me: () => request<{ user: ApiUser }>("/auth/me"),
  logout: (refreshToken: string | null) =>
    request<{ ok: true }>("/auth/logout", {
      method: "POST",
      body: { refreshToken },
      auth: false,
    }),
  todayMemo: () => request<MemoWithBody>("/memos/today"),
  getMemo: (id: string) => request<MemoWithBody>(`/memos/${id}`),
  getMemoByDate: (dateKst: string) =>
    request<MemoWithBody>(`/memos/by-date/${dateKst}`),
  patchMemo: (id: string, body: string, expectedUpdatedAt?: string) =>
    request<MemoWithBody>(`/memos/${id}`, {
      method: "PATCH",
      body: { body, expectedUpdatedAt },
    }),
  searchMemos: (q: string, from?: string, to?: string) =>
    request<{ items: Memo[]; nextCursor: string | null }>(`/memos/search`, {
      query: { q, from, to },
    }),
  listMemos: () =>
    request<{ items: Memo[]; nextCursor: string | null }>(`/memos`),
  activityGrid: (from?: string, to?: string) =>
    request<ActivityGrid>(`/activity/grid`, { query: { from, to } }),
  creditBalance: () => request<{ balance: number }>("/credit/balance"),
  creditTransactions: () =>
    request<{ items: CreditTx[]; nextCursor: string | null }>(
      "/credit/transactions",
    ),
  adminListUsers: (query?: { q?: string; page?: number }) =>
    request<{ items: AdminUserRow[]; nextCursor: string | null }>(
      "/admin/users",
      { query: { q: query?.q, page: query?.page } },
    ),
  adminGetUser: (id: string) =>
    request<AdminUserRow>(`/admin/users/${id}`),
  adminGrant: (id: string, amount: number, reason: string) =>
    request<{ delta: number; balanceAfter: number }>(
      `/admin/users/${id}/credit/grant`,
      { method: "POST", body: { amount, reason } },
    ),
  adminRevoke: (id: string, amount: number, reason: string) =>
    request<{ requested: number; delta: number; balanceAfter: number }>(
      `/admin/users/${id}/credit/revoke`,
      { method: "POST", body: { amount, reason } },
    ),
  adminSuspend: (id: string) =>
    request<{ ok: true }>(`/admin/users/${id}/suspend`, { method: "POST" }),
  adminUnsuspend: (id: string) =>
    request<{ ok: true }>(`/admin/users/${id}/unsuspend`, { method: "POST" }),
};

// ---------- Types mirrored from backend domain ----------

export interface Memo {
  id: string;
  userId: string;
  dateKst: string;
  title: string;
  charCount: number;
  r2ObjectKey: string;
  encryptedDek: string;
  dekAlgo: string;
  iv: string;
  bodySha256: string | null;
  isReadonly: boolean;
  readonlyAt: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MemoWithBody extends Memo {
  body: string;
}

export interface ActivityCell {
  date: string;
  charCount: number;
  memoId: string | null;
  level: 0 | 1 | 2 | 3 | 4;
}

export interface ActivityGrid {
  from: string;
  to: string;
  cells: ActivityCell[];
}

export interface CreditTx {
  id: string;
  delta: number;
  reason: string;
  balanceAfter: number;
  createdAt: string;
  referenceId?: string | null;
}

export interface AdminUserRow {
  id: string;
  email: string;
  displayName: string;
  creditBalance: number;
  role?: "user" | "admin" | "superadmin";
  isSuspended?: boolean;
  createdAt?: string;
}
