/**
 * Cloudflare Workers env bindings.
 * Mirror the wrangler.jsonc bindings here.
 */
export interface Env {
  /** D1 database for relational data. */
  DB: D1Database;
  /** R2 bucket for encrypted memo blobs. */
  MEMO_BUCKET: R2Bucket;
  /** KV for sessions/rate-limit + daily prompt pool (`prompt-pool:YYYY-MM-DD`). */
  SESSION_KV: KVNamespace;
  /** Workers AI binding — Qwen2.5-7B for daily writing prompt generation. */
  AI: Ai;

  // --- secrets (set via `wrangler secret put`) ---
  /** JWT signing secret (HS256). */
  JWT_SECRET: string;
  /** Master KEK for envelope-encryption (base64 32-byte). */
  KEK_MASTER: string;
  /** Resend API key for transactional email. */
  RESEND_API_KEY?: string;
  /** Google OAuth client id (id-token aud verification). */
  GOOGLE_CLIENT_ID?: string;
  /** Apple Sign-In client id. */
  APPLE_CLIENT_ID?: string;

  // --- vars ---
  ENVIRONMENT: "dev" | "stage" | "prod";
}

/** Hono variables propagated per-request. */
export interface Variables {
  userId: string;
  role: "user" | "admin" | "superadmin";
  isSuspended: boolean;
}
