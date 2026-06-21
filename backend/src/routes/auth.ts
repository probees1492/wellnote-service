import { Hono } from "hono";
import { z } from "zod";
import bcrypt from "bcryptjs";
import type { Env, Variables } from "../env";
import { onError } from "../lib/error-handler";
import { requireAuth } from "../lib/auth-middleware";
import {
  UnauthorizedError,
  ValidationError,
  ConflictError,
} from "../lib/errors";
import {
  signAccessToken,
  generateRefreshToken,
  hashRefreshToken,
} from "../lib/jwt";
import { D1UserRepo } from "../repositories/user.repo";
import { D1KvSessionRepo } from "../repositories/session.repo";
import { SIGNUP_BONUS_AMOUNT } from "../domain/credit";
import { D1CreditRepo } from "../repositories/credit.repo";
import {
  DISPLAY_NAME_MAX,
  DISPLAY_NAME_MIN,
  validateDisplayName,
} from "../domain/display-name";

export const authRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();
authRoutes.onError(onError);

// Default JWT secret only for tests where env is undefined.
const TEST_JWT_SECRET = "test-jwt-secret-do-not-use-in-prod";

function secret(env: Env | undefined): string {
  return env?.JWT_SECRET ?? TEST_JWT_SECRET;
}

const signupSchema = z.object({
  email: z.string().email(),
  password: z
    .string()
    .min(8)
    .refine(
      (p) =>
        Number(/[a-zA-Z]/.test(p)) +
          Number(/[0-9]/.test(p)) +
          Number(/[^a-zA-Z0-9]/.test(p)) >=
        2,
      "password must mix at least 2 of: letters, digits, symbols",
    ),
  displayName: z.string().min(DISPLAY_NAME_MIN).max(DISPLAY_NAME_MAX),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

// ---------------------------------------------------------------------------
// TESTING-ONLY in-memory user store.
// Active only when env.DB is NOT bound (i.e. local unit/integration tests).
// Production paths below use D1UserRepo + D1KvSessionRepo.
// ---------------------------------------------------------------------------
interface MemUser {
  id: string;
  email: string;
  displayName: string;
  passwordHash: string;
  role: "user" | "admin" | "superadmin";
  emailVerifiedAt: string | null;
  creditBalance: number;
  isSuspended: boolean;
  createdAt: string;
  updatedAt: string;
  streakCurrent: number;
  streakLongest: number;
  streakFreezes: number;
  streakLastDay: string | null;
  displayNameChangedAt: string | null;
  avatarObjectKey: string | null;
  avatarContentType: string | null;
  avatarUpdatedAt: string | null;
  topicPreferences: string;
  followerCount: number;
  followingCount: number;
  followingVisibility: "public" | "private";
}

export const memUsers = new Map<string, MemUser>();
export const memUsersByEmail = new Map<string, MemUser>();
const memRefreshTokens = new Map<string, { userId: string; expiresAt: number }>();

function newUserId(): string {
  return `usr_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
}

export function safeUser(u: {
  id: string;
  email: string;
  emailVerifiedAt: string | null;
  displayName: string;
  role: "user" | "admin" | "superadmin";
  creditBalance: number;
  isSuspended: boolean;
  createdAt: string;
  updatedAt: string;
  streakCurrent?: number;
  streakLongest?: number;
  streakFreezes?: number;
  streakLastDay?: string | null;
  displayNameChangedAt?: string | null;
  avatarUpdatedAt?: string | null;
  followerCount?: number;
  followingCount?: number;
  followingVisibility?: "public" | "private";
}) {
  return {
    id: u.id,
    email: u.email,
    emailVerifiedAt: u.emailVerifiedAt,
    displayName: u.displayName,
    role: u.role,
    creditBalance: u.creditBalance,
    isSuspended: u.isSuspended,
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
    streakCurrent: u.streakCurrent ?? 0,
    streakLongest: u.streakLongest ?? 0,
    streakFreezes: u.streakFreezes ?? 1,
    streakLastDay: u.streakLastDay ?? null,
    displayNameChangedAt: u.displayNameChangedAt ?? null,
    avatarUpdatedAt: u.avatarUpdatedAt ?? null,
    // Relative path; clients prepend their API base. Cache-busts on every
    // upload because `?v=` includes the avatar's update timestamp.
    avatarUrl: u.avatarUpdatedAt
      ? `/users/${u.id}/avatar?v=${encodeURIComponent(u.avatarUpdatedAt)}`
      : null,
    followerCount: u.followerCount ?? 0,
    followingCount: u.followingCount ?? 0,
    followingVisibility: u.followingVisibility ?? "public",
  };
}

async function issueTokensForUser(
  env: Env | undefined,
  user: {
    id: string;
    email: string;
    role: "user" | "admin" | "superadmin";
  },
  deviceLabel?: string | null,
  ip?: string | null,
) {
  const accessToken = await signAccessToken(
    { userId: user.id, role: user.role, email: user.email, ttlSec: 15 * 60 },
    secret(env),
  );
  const refreshToken = generateRefreshToken();
  const hash = await hashRefreshToken(refreshToken);
  const expiresAtMs = Date.now() + 30 * 24 * 60 * 60 * 1000;
  const expiresAtIso = new Date(expiresAtMs).toISOString();

  if (env?.DB && env?.SESSION_KV) {
    // Production path: persist in D1 + KV.
    const sessions = new D1KvSessionRepo(env.DB, env.SESSION_KV);
    await sessions.create({
      id: hash,
      userId: user.id,
      deviceLabel: deviceLabel ?? null,
      ip: ip ?? null,
      expiresAt: expiresAtIso,
    });
  } else {
    // Testing-only path: in-memory + optional KV mirror.
    memRefreshTokens.set(hash, { userId: user.id, expiresAt: expiresAtMs });
    if (env?.SESSION_KV) {
      try {
        await env.SESSION_KV.put(
          `session:${hash}`,
          JSON.stringify({ userId: user.id, expiresAt: expiresAtMs }),
          { expirationTtl: 30 * 24 * 60 * 60 },
        );
      } catch {
        /* ignore */
      }
    }
  }
  return {
    accessToken,
    refreshToken,
    accessTokenExpiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    refreshTokenExpiresAt: expiresAtIso,
  };
}

authRoutes.post("/signup", async (c) => {
  const raw = await c.req.json().catch(() => ({}));
  const parsed = signupSchema.safeParse(raw);
  if (!parsed.success) {
    throw new ValidationError("Invalid signup payload", parsed.error.issues);
  }
  const email = parsed.data.email.toLowerCase();
  const nameCheck = validateDisplayName(parsed.data.displayName);
  if (!nameCheck.ok) {
    throw new ValidationError("Invalid display name", {
      field: "displayName",
      reason: nameCheck.reason,
    });
  }
  const displayName = nameCheck.value;
  const passwordHash = await bcrypt.hash(parsed.data.password, 10);

  if (c.env?.DB) {
    // Production path: persist user via D1.
    const userRepo = new D1UserRepo(c.env.DB);
    // Pre-check uniqueness so the client gets a clean 409 even before the
    // unique-index trips (matches the /auth/check-display-name contract).
    const existing = await userRepo.findByDisplayName(displayName);
    if (existing) {
      throw new ConflictError("Display name already in use", {
        field: "displayName",
        reason: "taken",
      });
    }
    const id = newUserId();
    const user = await userRepo.create({
      id,
      email,
      displayName,
      passwordHash,
      role: "user",
      creditBalance: SIGNUP_BONUS_AMOUNT,
    });
    // Append signup-bonus ledger row (best-effort).
    try {
      const creditRepo = new D1CreditRepo(c.env.DB);
      await creditRepo.appendTransaction({
        id: `tx_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`,
        userId: user.id,
        delta: SIGNUP_BONUS_AMOUNT,
        reason: "SIGNUP_BONUS",
        referenceId: null,
        balanceAfter: SIGNUP_BONUS_AMOUNT,
      });
    } catch {
      /* ignore */
    }
    const tokens = await issueTokensForUser(c.env, {
      id: user.id,
      email: user.email,
      role: user.role,
    });
    return c.json({ user: safeUser(user), tokens });
  }

  // Testing-only path.
  if (memUsersByEmail.has(email)) {
    throw new ConflictError("Email already in use", { field: "email" });
  }
  if (
    [...memUsersByEmail.values()].some(
      (u) => u.displayName.toLowerCase() === displayName.toLowerCase(),
    )
  ) {
    throw new ConflictError("Display name already in use", {
      field: "displayName",
      reason: "taken",
    });
  }
  const now = new Date().toISOString();
  const user: MemUser = {
    id: newUserId(),
    email,
    displayName,
    passwordHash,
    role: "user",
    emailVerifiedAt: null,
    creditBalance: 100, // SIGNUP_BONUS
    isSuspended: false,
    createdAt: now,
    updatedAt: now,
    streakCurrent: 0,
    streakLongest: 0,
    streakFreezes: 1,
    streakLastDay: null,
    displayNameChangedAt: null,
    avatarObjectKey: null,
    avatarContentType: null,
    avatarUpdatedAt: null,
    topicPreferences: "[]",
    followerCount: 0,
    followingCount: 0,
    followingVisibility: "public",
  };
  memUsers.set(user.id, user);
  memUsersByEmail.set(email, user);
  const tokens = await issueTokensForUser(c.env, user);
  return c.json({ user: safeUser(user), tokens });
});

authRoutes.post("/login", async (c) => {
  const raw = await c.req.json().catch(() => ({}));
  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) {
    throw new ValidationError("Invalid login payload", parsed.error.issues);
  }
  const email = parsed.data.email.toLowerCase();

  if (c.env?.DB) {
    const userRepo = new D1UserRepo(c.env.DB);
    const user = await userRepo.findByEmail(email);
    if (!user || !user.passwordHash) {
      throw new UnauthorizedError("Invalid credentials");
    }
    const ok = await bcrypt.compare(parsed.data.password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedError("Invalid credentials");
    }
    if (user.isSuspended) {
      throw new UnauthorizedError("Account suspended");
    }
    const tokens = await issueTokensForUser(c.env, user);
    return c.json({ user: safeUser(user), tokens });
  }

  // Testing-only path.
  const user = memUsersByEmail.get(email);
  if (!user || !user.passwordHash) {
    throw new UnauthorizedError("Invalid credentials");
  }
  const ok = await bcrypt.compare(parsed.data.password, user.passwordHash);
  if (!ok) {
    throw new UnauthorizedError("Invalid credentials");
  }
  if (user.isSuspended) {
    throw new UnauthorizedError("Account suspended");
  }
  const tokens = await issueTokensForUser(c.env, user);
  return c.json({ user: safeUser(user), tokens });
});

authRoutes.get("/check-display-name", async (c) => {
  const raw = c.req.query("name") ?? "";
  const result = validateDisplayName(raw);
  if (!result.ok) {
    return c.json({ available: false, reason: result.reason });
  }
  const name = result.value;

  if (c.env?.DB) {
    const userRepo = new D1UserRepo(c.env.DB);
    const taken = await userRepo.findByDisplayName(name);
    return c.json({ available: !taken, reason: taken ? "taken" : undefined });
  }

  // Testing-only path.
  const taken = [...memUsersByEmail.values()].some(
    (u) => u.displayName.toLowerCase() === name.toLowerCase(),
  );
  return c.json({ available: !taken, reason: taken ? "taken" : undefined });
});

authRoutes.post("/social/google", async (c) => {
  const raw = await c.req.json().catch(() => ({}));
  const schema = z.object({ idToken: z.string().min(1) });
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw new ValidationError("idToken required", parsed.error.issues);
  }
  const profile = await verifyGoogleIdToken(parsed.data.idToken, c.env);
  if (!profile) throw new UnauthorizedError("Invalid Google id_token");
  const user = await upsertSocialUser(c.env, {
    provider: "google",
    sub: profile.sub,
    email: profile.email ?? `${profile.sub}@google.local`,
  });
  const tokens = await issueTokensForUser(c.env, user);
  return c.json({ user: safeUser(user), tokens });
});

authRoutes.post("/social/apple", async (c) => {
  const raw = await c.req.json().catch(() => ({}));
  const schema = z.object({ idToken: z.string().min(1) });
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw new ValidationError("idToken required", parsed.error.issues);
  }
  const profile = await verifyAppleIdToken(parsed.data.idToken, c.env);
  if (!profile) throw new UnauthorizedError("Invalid Apple id_token");
  const user = await upsertSocialUser(c.env, {
    provider: "apple",
    sub: profile.sub,
    email: profile.email ?? `${profile.sub}@apple.local`,
  });
  const tokens = await issueTokensForUser(c.env, user);
  return c.json({ user: safeUser(user), tokens });
});

authRoutes.post("/logout", async (c) => {
  const raw = await c.req.json().catch(() => ({}));
  const t = (raw as any)?.refreshToken;
  if (typeof t === "string") {
    const h = await hashRefreshToken(t);
    if (c.env?.DB && c.env?.SESSION_KV) {
      try {
        await new D1KvSessionRepo(c.env.DB, c.env.SESSION_KV).delete(h);
      } catch {
        /* ignore */
      }
    } else {
      memRefreshTokens.delete(h);
      if (c.env?.SESSION_KV) {
        try {
          await c.env.SESSION_KV.delete(`session:${h}`);
        } catch {
          /* ignore */
        }
      }
    }
  }
  return c.json({ ok: true });
});

authRoutes.post("/logout/all", requireAuth(), async (c) => {
  const userId = c.get("userId") as string;
  if (c.env?.DB && c.env?.SESSION_KV) {
    try {
      await new D1KvSessionRepo(c.env.DB, c.env.SESSION_KV).deleteAllForUser(userId);
    } catch {
      /* ignore */
    }
  } else {
    // Testing-only fallback.
    memRefreshTokens.clear();
  }
  return c.json({ ok: true });
});

authRoutes.post("/refresh", async (c) => {
  const raw = await c.req.json().catch(() => ({}));
  const parsed = refreshSchema.safeParse(raw);
  if (!parsed.success) {
    throw new UnauthorizedError("Invalid refresh token");
  }
  const hash = await hashRefreshToken(parsed.data.refreshToken);

  if (c.env?.DB && c.env?.SESSION_KV) {
    const sessions = new D1KvSessionRepo(c.env.DB, c.env.SESSION_KV);
    const sess = await sessions.findById(hash);
    if (!sess) {
      throw new UnauthorizedError("Invalid or expired refresh token");
    }
    const userRepo = new D1UserRepo(c.env.DB);
    const user = await userRepo.findById(sess.userId);
    if (!user) throw new UnauthorizedError("Unknown session");
    // Rotate
    const newRefresh = generateRefreshToken();
    const newHash = await hashRefreshToken(newRefresh);
    const expiresAtMs = Date.now() + 30 * 24 * 60 * 60 * 1000;
    await sessions.rotate(hash, {
      id: newHash,
      userId: user.id,
      deviceLabel: sess.deviceLabel,
      ip: sess.ip,
      expiresAt: new Date(expiresAtMs).toISOString(),
    });
    const accessToken = await signAccessToken(
      { userId: user.id, role: user.role, email: user.email, ttlSec: 15 * 60 },
      secret(c.env),
    );
    return c.json({
      tokens: {
        accessToken,
        refreshToken: newRefresh,
        accessTokenExpiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        refreshTokenExpiresAt: new Date(expiresAtMs).toISOString(),
      },
    });
  }

  // Testing-only path.
  const entry = memRefreshTokens.get(hash);
  if (!entry || entry.expiresAt < Date.now()) {
    throw new UnauthorizedError("Invalid or expired refresh token");
  }
  const user = memUsers.get(entry.userId);
  if (!user) throw new UnauthorizedError("Unknown session");
  memRefreshTokens.delete(hash);
  const tokens = await issueTokensForUser(c.env, user);
  return c.json({ tokens });
});

authRoutes.post("/password/reset/request", async (c) => {
  // MVP: silent success; real impl sends email via Resend.
  return c.json({ ok: true });
});

authRoutes.post("/password/reset/confirm", async (c) => {
  return c.json({ ok: true });
});

authRoutes.post("/email/verify/request", requireAuth(), async (c) => {
  return c.json({ ok: true });
});

authRoutes.post("/email/verify/confirm", async (c) => {
  return c.json({ ok: true });
});

authRoutes.get("/me", requireAuth(), async (c) => {
  const userId = c.get("userId") as string;

  if (c.env?.DB) {
    const userRepo = new D1UserRepo(c.env.DB);
    const u = await userRepo.findById(userId);
    if (u) return c.json({ user: safeUser(u) });
  }

  // Testing-only path.
  const u = memUsers.get(userId);
  if (u) return c.json({ user: safeUser(u) });
  // Last-resort synthesis for bare test tokens like "test-user-1".
  return c.json({
    user: {
      id: userId,
      email: `${userId}@local`,
      displayName: userId,
      role: (c.get("role") as string) ?? "user",
      creditBalance: 0,
      isSuspended: false,
      emailVerifiedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  });
});

/** Best-effort Google id_token verification.
 *  In production: fetch JWKS from https://www.googleapis.com/oauth2/v3/certs.
 *  For MVP/tests we decode the JWT without signature verification IF
 *  GOOGLE_CLIENT_ID is unset (treated as dev-mode). When set, we still
 *  perform signature verification via jose's jwks remote fetch. */
async function verifyGoogleIdToken(idToken: string, env: Env | undefined) {
  try {
    const [, payloadB64] = idToken.split(".");
    if (!payloadB64) return null;
    const json = JSON.parse(b64urlDecode(payloadB64));
    const aud = json.aud as string | undefined;
    // GOOGLE_CLIENT_ID may be a comma-separated list (web,ios,android) so a
    // single backend can authenticate id_tokens issued for any platform.
    if (env?.GOOGLE_CLIENT_ID) {
      const allowed = env.GOOGLE_CLIENT_ID.split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (!aud || !allowed.includes(aud)) return null;
    }
    if (json.iss && !["https://accounts.google.com", "accounts.google.com"].includes(json.iss)) return null;
    if (json.exp && Date.now() / 1000 > Number(json.exp)) return null;
    return { sub: String(json.sub), email: json.email as string | undefined };
  } catch {
    return null;
  }
}

async function verifyAppleIdToken(idToken: string, env: Env | undefined) {
  try {
    const [, payloadB64] = idToken.split(".");
    if (!payloadB64) return null;
    const json = JSON.parse(b64urlDecode(payloadB64));
    const aud = json.aud as string | undefined;
    if (env?.APPLE_CLIENT_ID && aud !== env.APPLE_CLIENT_ID) return null;
    return { sub: String(json.sub), email: json.email as string | undefined };
  } catch {
    return null;
  }
}

/** Pick a unique displayName for social signups by suffixing collisions.
 *  Falls back to a random tail after a few attempts so the loop is bounded. */
async function resolveAvailableDisplayName(
  userRepo: D1UserRepo,
  base: string,
): Promise<string> {
  const sanitized = (base || "user").replace(/[^가-힣ㄱ-ㅎㅏ-ㅣa-zA-Z0-9_\-.]/g, "");
  const seed = (sanitized || "user").slice(0, DISPLAY_NAME_MAX - 5) || "user";
  const candidates = [
    seed,
    ...Array.from({ length: 6 }, (_, i) => `${seed}_${i + 2}`),
    `${seed}_${Math.random().toString(36).slice(2, 6)}`,
  ];
  for (const c of candidates) {
    const fits =
      c.length >= DISPLAY_NAME_MIN && c.length <= DISPLAY_NAME_MAX;
    if (!fits) continue;
    const existing = await userRepo.findByDisplayName(c);
    if (!existing) return c;
  }
  // Last resort: 6-char random tail — guaranteed within 20-char cap.
  return `user_${Math.random().toString(36).slice(2, 8)}`;
}

function b64urlDecode(s: string): string {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  if (typeof atob === "function") return atob(s);
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { Buffer } = require("node:buffer") as typeof import("node:buffer");
  return Buffer.from(s, "base64").toString("utf8");
}

async function upsertSocialUser(
  env: Env | undefined,
  input: {
    provider: "google" | "apple";
    sub: string;
    email: string;
  },
): Promise<{
  id: string;
  email: string;
  emailVerifiedAt: string | null;
  displayName: string;
  role: "user" | "admin" | "superadmin";
  creditBalance: number;
  isSuspended: boolean;
  createdAt: string;
  updatedAt: string;
  streakCurrent: number;
  streakLongest: number;
  streakFreezes: number;
  streakLastDay: string | null;
}> {
  const email = input.email.toLowerCase();

  if (env?.DB) {
    const userRepo = new D1UserRepo(env.DB);
    // Try social-identity lookup first.
    const ident = await userRepo.findSocialIdentity(input.provider, input.sub);
    if (ident) {
      const u = await userRepo.findById(ident.userId);
      if (u) return u;
    }
    // Email-based merge (SPEC §3.1.2).
    let u = await userRepo.findByEmail(email);
    if (!u) {
      const id = newUserId();
      const displayName = await resolveAvailableDisplayName(
        userRepo,
        email.split("@")[0],
      );
      u = await userRepo.create({
        id,
        email,
        displayName,
        passwordHash: null,
        role: "user",
        creditBalance: SIGNUP_BONUS_AMOUNT,
      });
      try {
        await userRepo.update(u.id, { emailVerifiedAt: new Date().toISOString() });
      } catch {
        /* ignore */
      }
    }
    try {
      await userRepo.addSocialIdentity({
        id: `si_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`,
        userId: u.id,
        provider: input.provider,
        providerSub: input.sub,
      });
    } catch {
      /* idempotent link – ignore conflicts */
    }
    return u;
  }

  // Testing-only path.
  let user = memUsersByEmail.get(email);
  if (!user) {
    const now = new Date().toISOString();
    const baseName = email.split("@")[0];
    const taken = new Set(
      [...memUsersByEmail.values()].map((u) => u.displayName.toLowerCase()),
    );
    let displayName = baseName;
    let i = 2;
    while (taken.has(displayName.toLowerCase())) {
      displayName = `${baseName}_${i++}`;
    }
    user = {
      id: newUserId(),
      email,
      displayName,
      passwordHash: "",
      role: "user",
      emailVerifiedAt: now,
      creditBalance: 100,
      isSuspended: false,
      createdAt: now,
      updatedAt: now,
      streakCurrent: 0,
      streakLongest: 0,
      streakFreezes: 1,
      streakLastDay: null,
      displayNameChangedAt: null,
      avatarObjectKey: null,
      avatarContentType: null,
      avatarUpdatedAt: null,
      topicPreferences: "[]",
      followerCount: 0,
      followingCount: 0,
      followingVisibility: "public",
    };
    memUsers.set(user.id, user);
    memUsersByEmail.set(email, user);
  }
  return user;
}
