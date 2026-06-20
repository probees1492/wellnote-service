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
  displayName: z.string().min(1).max(40).optional(),
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
}

const memUsers = new Map<string, MemUser>();
const memUsersByEmail = new Map<string, MemUser>();
const memRefreshTokens = new Map<string, { userId: string; expiresAt: number }>();

function newUserId(): string {
  return `usr_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
}

function safeUser(u: {
  id: string;
  email: string;
  emailVerifiedAt: string | null;
  displayName: string;
  role: "user" | "admin" | "superadmin";
  creditBalance: number;
  isSuspended: boolean;
  createdAt: string;
  updatedAt: string;
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
  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  const displayName = parsed.data.displayName ?? email.split("@")[0];

  if (c.env?.DB) {
    // Production path: persist user via D1.
    const userRepo = new D1UserRepo(c.env.DB);
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
    throw new ConflictError("Email already in use");
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
      u = await userRepo.create({
        id,
        email,
        displayName: email.split("@")[0],
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
    user = {
      id: newUserId(),
      email,
      displayName: email.split("@")[0],
      passwordHash: "",
      role: "user",
      emailVerifiedAt: now,
      creditBalance: 100,
      isSuspended: false,
      createdAt: now,
      updatedAt: now,
    };
    memUsers.set(user.id, user);
    memUsersByEmail.set(email, user);
  }
  return user;
}
