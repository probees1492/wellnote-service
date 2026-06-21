"use client";

import { create } from "zustand";
import { api, tokenStore, type ApiUser, type Tokens } from "./api";

interface LoginOpts {
  remember?: boolean;
}

interface AuthState {
  user: ApiUser | null;
  hydrated: boolean;
  hydrate: () => void;
  login: (
    email: string,
    password: string,
    opts?: LoginOpts,
  ) => Promise<void>;
  signup: (
    email: string,
    password: string,
    displayName: string,
    opts?: LoginOpts,
  ) => Promise<void>;
  loginWithGoogle: (idToken: string, opts?: LoginOpts) => Promise<void>;
  logout: () => Promise<void>;
  refreshMe: () => Promise<void>;
}

function applyMode(remember: boolean | undefined) {
  // Default to persistent (remember = true) when unspecified for backwards
  // compatibility with callers that have not yet been updated.
  const mode = remember === false ? "session" : "persistent";
  tokenStore.setMode(mode);
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  hydrated: false,
  hydrate: () => {
    if (typeof window === "undefined") return;
    const u = tokenStore.getUser();
    set({ user: u, hydrated: true });
  },
  login: async (email, password, opts) => {
    applyMode(opts?.remember);
    const r = await api.login({ email, password });
    tokenStore.set(r.tokens, r.user);
    set({ user: r.user });
  },
  signup: async (email, password, displayName, opts) => {
    applyMode(opts?.remember);
    const r = await api.signup({ email, password, displayName });
    tokenStore.set(r.tokens, r.user);
    set({ user: r.user });
  },
  loginWithGoogle: async (idToken, opts) => {
    applyMode(opts?.remember);
    const r = await api.socialGoogle({ idToken });
    tokenStore.set(r.tokens, r.user);
    set({ user: r.user });
  },
  logout: async () => {
    const refresh = tokenStore.getRefresh();
    try {
      await api.logout(refresh);
    } catch {
      /* ignore */
    }
    tokenStore.clear();
    set({ user: null });
  },
  refreshMe: async () => {
    try {
      const r = await api.me();
      tokenStore.setUser(r.user);
      set({ user: r.user });
    } catch {
      /* ignore */
    }
  },
}));

// ---------------------------------------------------------------------------
// 필명 (display name) — client-side policy mirrors backend/src/domain/display-name.ts.
// Keep both in sync; the server is still the source of truth.
// ---------------------------------------------------------------------------

export const DISPLAY_NAME_MIN = 2;
export const DISPLAY_NAME_MAX = 20;
const DISPLAY_NAME_ALLOWED = /^[가-힣ㄱ-ㅎㅏ-ㅣa-zA-Z0-9 _\-.]+$/u;
const DISPLAY_NAME_HAS_ALPHANUM = /[가-힣ㄱ-ㅎㅏ-ㅣa-zA-Z0-9]/u;

export type DisplayNameReason =
  | "required"
  | "too_short"
  | "too_long"
  | "invalid_chars"
  | "taken";

export type DisplayNameValidation =
  | { ok: true; value: string }
  | { ok: false; reason: Exclude<DisplayNameReason, "taken"> };

export function validateDisplayNameClient(raw: string): DisplayNameValidation {
  const v = raw.trim();
  if (v.length === 0) return { ok: false, reason: "required" };
  if (v.length < DISPLAY_NAME_MIN) return { ok: false, reason: "too_short" };
  if (v.length > DISPLAY_NAME_MAX) return { ok: false, reason: "too_long" };
  if (!DISPLAY_NAME_ALLOWED.test(v)) return { ok: false, reason: "invalid_chars" };
  if (!DISPLAY_NAME_HAS_ALPHANUM.test(v)) return { ok: false, reason: "invalid_chars" };
  return { ok: true, value: v };
}

export function displayNameReasonLabel(reason: DisplayNameReason): string {
  switch (reason) {
    case "required":
      return "필명을 입력해주세요.";
    case "too_short":
      return `필명은 ${DISPLAY_NAME_MIN}자 이상이어야 합니다.`;
    case "too_long":
      return `필명은 ${DISPLAY_NAME_MAX}자 이하여야 합니다.`;
    case "invalid_chars":
      return "한글·영문·숫자·공백·_-. 만 사용할 수 있습니다.";
    case "taken":
      return "이미 사용 중인 필명입니다.";
  }
}
