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
    displayName?: string,
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
