import type { User, UserRole } from "../domain/user";
import type { Memo } from "../domain/memo";

export interface AdminListUsersOpts {
  cursor?: string;
  limit?: number;
  query?: string;
  role?: UserRole;
  isSuspended?: boolean;
}

export interface AdminGrantInput {
  actorUserId: string;
  targetUserId: string;
  amount: number;
  reason: string;
}

export interface AdminRevokeInput extends AdminGrantInput {}

export interface AdminForceReadonlyInput {
  actorUserId: string;
  memoId: string;
  reason: string;
}

export interface AdminSuspendInput {
  actorUserId: string;
  targetUserId: string;
  reason: string;
}

export interface AdminStats {
  totalUsers: number;
  dailyActiveUsers: number;
  memosToday: number;
  avgCharCount: number;
  totalCredits: number;
  avgCredits: number;
}

export interface AdminService {
  /** Assert the actor has admin/superadmin role. Throws ForbiddenError otherwise. */
  assertAdmin(actorUserId: string, minRole?: "admin" | "superadmin"): Promise<UserRole>;

  listUsers(opts: AdminListUsersOpts): Promise<{ items: User[]; nextCursor: string | null }>;
  getUser(targetUserId: string): Promise<User>;

  grantCredit(input: AdminGrantInput): Promise<{ delta: number; balanceAfter: number }>;
  revokeCredit(input: AdminRevokeInput): Promise<{ requested: number; delta: number; balanceAfter: number }>;
  forceReadonly(input: AdminForceReadonlyInput): Promise<Memo>;
  suspend(input: AdminSuspendInput): Promise<void>;
  unsuspend(input: AdminSuspendInput): Promise<void>;
  kickSessions(input: AdminSuspendInput): Promise<{ killed: number }>;

  stats(): Promise<AdminStats>;
  auditLog(opts: {
    actorUserId?: string;
    targetUserId?: string;
    from?: string;
    to?: string;
    cursor?: string;
    limit?: number;
  }): Promise<{ items: AdminAuditEntry[]; nextCursor: string | null }>;
}

export interface AdminAuditEntry {
  id: string;
  actorUserId: string;
  targetUserId: string | null;
  actionType: string;
  payload: Record<string, unknown> | null;
  reason: string;
  createdAt: string;
}

export class DefaultAdminService implements AdminService {
  assertAdmin(_actorUserId: string, _minRole?: "admin" | "superadmin"): Promise<UserRole> { throw new Error("not implemented"); }
  listUsers(_opts: AdminListUsersOpts): Promise<{ items: User[]; nextCursor: string | null }> { throw new Error("not implemented"); }
  getUser(_targetUserId: string): Promise<User> { throw new Error("not implemented"); }
  grantCredit(_input: AdminGrantInput): Promise<{ delta: number; balanceAfter: number }> { throw new Error("not implemented"); }
  revokeCredit(_input: AdminRevokeInput): Promise<{ requested: number; delta: number; balanceAfter: number }> { throw new Error("not implemented"); }
  forceReadonly(_input: AdminForceReadonlyInput): Promise<Memo> { throw new Error("not implemented"); }
  suspend(_input: AdminSuspendInput): Promise<void> { throw new Error("not implemented"); }
  unsuspend(_input: AdminSuspendInput): Promise<void> { throw new Error("not implemented"); }
  kickSessions(_input: AdminSuspendInput): Promise<{ killed: number }> { throw new Error("not implemented"); }
  stats(): Promise<AdminStats> { throw new Error("not implemented"); }
  auditLog(_opts: { actorUserId?: string; targetUserId?: string; from?: string; to?: string; cursor?: string; limit?: number }): Promise<{ items: AdminAuditEntry[]; nextCursor: string | null }> {
    throw new Error("not implemented");
  }
}
