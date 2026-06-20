/**
 * JWT helpers (HS256) using `jose`.
 */
import { SignJWT, jwtVerify } from "jose";
import { UnauthorizedError } from "./errors";

export interface AccessTokenPayload {
  sub: string;
  role: "user" | "admin" | "superadmin";
  email?: string;
  iat: number;
  exp: number;
}

export interface JwtIssueOptions {
  userId: string;
  role: AccessTokenPayload["role"];
  email?: string;
  /** seconds */
  ttlSec?: number;
}

function secretKey(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

export async function signAccessToken(
  opts: JwtIssueOptions,
  secret: string,
): Promise<string> {
  const ttl = opts.ttlSec ?? 15 * 60;
  return new SignJWT({ role: opts.role, email: opts.email })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(opts.userId)
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + ttl)
    .sign(secretKey(secret));
}

export async function verifyAccessToken(
  token: string,
  secret: string,
): Promise<AccessTokenPayload> {
  try {
    const { payload } = await jwtVerify(token, secretKey(secret));
    return {
      sub: String(payload.sub ?? ""),
      role: (payload.role as AccessTokenPayload["role"]) ?? "user",
      email: payload.email as string | undefined,
      iat: payload.iat ?? 0,
      exp: payload.exp ?? 0,
    };
  } catch (e) {
    throw new UnauthorizedError("Invalid or expired token");
  }
}

export function generateRefreshToken(): string {
  // 32 random bytes, base64url
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  let s = "";
  for (let i = 0; i < arr.length; i++) s += String.fromCharCode(arr[i]);
  // btoa is available in Workers and modern Node.
  const b64 =
    typeof btoa === "function"
      ? btoa(s)
      : // eslint-disable-next-line @typescript-eslint/no-var-requires
        Buffer.from(arr).toString("base64");
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function hashRefreshToken(raw: string): Promise<string> {
  const data = new TextEncoder().encode(raw);
  const digest = await crypto.subtle.digest("SHA-256", data);
  const view = new Uint8Array(digest);
  let hex = "";
  for (let i = 0; i < view.length; i++) {
    const h = view[i].toString(16);
    hex += h.length === 1 ? `0${h}` : h;
  }
  return hex;
}
