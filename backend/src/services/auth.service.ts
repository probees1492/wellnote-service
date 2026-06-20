import type { User, UserRole } from "../domain/user";

export interface SignupInput {
  email: string;
  password: string;
  displayName?: string;
  deviceLabel?: string;
  ip?: string;
}

export interface LoginInput {
  email: string;
  password: string;
  deviceLabel?: string;
  ip?: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: string;
  refreshTokenExpiresAt: string;
}

export interface AuthResult {
  user: User;
  tokens: TokenPair;
}

export interface AuthService {
  /** Email + password signup. Awards +100 signup bonus. */
  signup(input: SignupInput): Promise<AuthResult>;

  /** Email + password login. */
  login(input: LoginInput): Promise<AuthResult>;

  /** Verify google id token; create or link user; returns AuthResult. */
  loginWithGoogle(input: { idToken: string; deviceLabel?: string; ip?: string }): Promise<AuthResult>;

  /** Apple id-token login; create or link user. */
  loginWithApple(input: { idToken: string; deviceLabel?: string; ip?: string }): Promise<AuthResult>;

  /** Refresh access token via refresh token; rotates refresh. */
  refresh(refreshToken: string): Promise<TokenPair>;

  /** Logout current session. */
  logout(refreshToken: string): Promise<void>;

  /** Logout all sessions for user. */
  logoutAll(userId: string): Promise<void>;

  /** Request password reset (sends email). */
  requestPasswordReset(email: string): Promise<void>;

  /** Confirm password reset with token. Invalidates all sessions. */
  confirmPasswordReset(token: string, newPassword: string): Promise<void>;

  /** Resend email verification mail. */
  requestEmailVerification(userId: string): Promise<void>;

  /** Verify email via one-shot token. */
  confirmEmailVerification(token: string): Promise<void>;

  /** Resolve current user from access token; throws if expired/suspended. */
  authenticate(accessToken: string): Promise<{ user: User; role: UserRole }>;
}

export class DefaultAuthService implements AuthService {
  signup(_input: SignupInput): Promise<AuthResult> { throw new Error("not implemented"); }
  login(_input: LoginInput): Promise<AuthResult> { throw new Error("not implemented"); }
  loginWithGoogle(_input: { idToken: string; deviceLabel?: string; ip?: string }): Promise<AuthResult> { throw new Error("not implemented"); }
  loginWithApple(_input: { idToken: string; deviceLabel?: string; ip?: string }): Promise<AuthResult> { throw new Error("not implemented"); }
  refresh(_refreshToken: string): Promise<TokenPair> { throw new Error("not implemented"); }
  logout(_refreshToken: string): Promise<void> { throw new Error("not implemented"); }
  logoutAll(_userId: string): Promise<void> { throw new Error("not implemented"); }
  requestPasswordReset(_email: string): Promise<void> { throw new Error("not implemented"); }
  confirmPasswordReset(_token: string, _newPassword: string): Promise<void> { throw new Error("not implemented"); }
  requestEmailVerification(_userId: string): Promise<void> { throw new Error("not implemented"); }
  confirmEmailVerification(_token: string): Promise<void> { throw new Error("not implemented"); }
  authenticate(_accessToken: string): Promise<{ user: User; role: UserRole }> { throw new Error("not implemented"); }
}
