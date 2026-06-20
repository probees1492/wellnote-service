"use client";

import { create } from "zustand";
import { api, tokenStore, type ApiUser, type Tokens } from "./api";

interface AuthState {
  user: ApiUser | null;
  hydrated: boolean;
  hydrate: () => void;
  login: (email: string, password: string) => Promise<void>;
  signup: (
    email: string,
    password: string,
    displayName?: string,
  ) => Promise<void>;
  logout: () => Promise<void>;
  refreshMe: () => Promise<void>;
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  hydrated: false,
  hydrate: () => {
    if (typeof window === "undefined") return;
    const u = tokenStore.getUser();
    set({ user: u, hydrated: true });
  },
  login: async (email, password) => {
    const r = await api.login({ email, password });
    tokenStore.set(r.tokens, r.user);
    set({ user: r.user });
  },
  signup: async (email, password, displayName) => {
    const r = await api.signup({ email, password, displayName });
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
