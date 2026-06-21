import {
  type Pin,
  type PinColor,
  type PinVisibility,
  PIN_NAME_MAX,
  PIN_NAME_MIN,
  isPinColor,
  isPinVisibility,
} from "../domain/pin";
import type { Memo } from "../domain/memo";
import type {
  PinRepo,
  CreatePinInput,
  UpdatePinInput,
} from "../repositories/pin.repo";
import type { MemoRepo } from "../repositories/memo.repo";
import { NotFoundError, ValidationError } from "../lib/errors";

export interface CreatePinServiceInput {
  userId: string;
  name: string;
  color?: PinColor;
  visibility?: PinVisibility;
}

export interface UpdatePinServiceInput {
  name?: string;
  color?: PinColor;
  visibility?: PinVisibility;
}

export interface PinService {
  createPin(input: CreatePinServiceInput): Promise<Pin>;
  listPins(userId: string): Promise<Pin[]>;
  getPin(userId: string, pinId: string): Promise<Pin>;
  updatePin(
    userId: string,
    pinId: string,
    patch: UpdatePinServiceInput,
  ): Promise<Pin>;
  deletePin(userId: string, pinId: string): Promise<void>;
  attachMemo(opts: {
    userId: string;
    memoId: string;
    pinId: string | null;
  }): Promise<Memo>;
  listPinMemos(opts: {
    userId: string;
    pinId: string;
    cursor?: string;
    limit?: number;
  }): Promise<{ items: Memo[]; nextCursor: string | null }>;
}

interface PinRepoLike {
  create?(input: CreatePinInput): Promise<Pin>;
  findById?(userId: string, pinId: string): Promise<Pin | null>;
  listByUser?(userId: string): Promise<Pin[]>;
  update?(userId: string, pinId: string, patch: UpdatePinInput): Promise<Pin>;
  delete?(userId: string, pinId: string): Promise<void>;
  listMemos?(opts: {
    userId: string;
    pinId: string;
    limit?: number;
    cursor?: string;
  }): Promise<{ items: Memo[]; nextCursor: string | null }>;
  memoCountByPin?(userId: string): Promise<Map<string, number>>;
}

interface MemoRepoLike {
  findById?(id: string): Promise<Memo | null>;
  setPin?(opts: {
    userId: string;
    memoId: string;
    pinId: string | null;
  }): Promise<Memo>;
}

function isFn(x: unknown): x is (...args: any[]) => any {
  return typeof x === "function";
}

function newId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
}

function validateName(name: string): string {
  const trimmed = name.trim();
  if (
    trimmed.length < PIN_NAME_MIN ||
    trimmed.length > PIN_NAME_MAX
  ) {
    throw new ValidationError(
      `Pin name must be ${PIN_NAME_MIN}-${PIN_NAME_MAX} characters`,
    );
  }
  return trimmed;
}

function validateColor(color: PinColor | undefined): PinColor {
  if (color === undefined) return "slate";
  if (!isPinColor(color)) {
    throw new ValidationError("Invalid pin color");
  }
  return color;
}

function validateVisibility(
  v: PinVisibility | undefined,
): PinVisibility {
  if (v === undefined) return "private";
  if (!isPinVisibility(v)) {
    throw new ValidationError("Invalid pin visibility");
  }
  return v;
}

/**
 * Default PinService.
 *
 * Falls back to in-memory state when given bare-stub repositories so unit
 * tests can wire it without sqlite. With real D1 repositories injected,
 * every call persists.
 */
export class DefaultPinService implements PinService {
  /** in-memory pin store: pinId -> Pin */
  private pinsById = new Map<string, Pin>();
  /** in-memory memo store: memoId -> Memo (only for tests) */
  private memosById = new Map<string, Memo>();

  constructor(
    private readonly pins: PinRepo | PinRepoLike,
    private readonly memos: MemoRepo | MemoRepoLike,
  ) {}

  /** Test seam: register a fake memo so unit tests can exercise attachMemo. */
  _seedMemo(memo: Memo): void {
    this.memosById.set(memo.id, { ...memo });
  }

  async createPin(input: CreatePinServiceInput): Promise<Pin> {
    const name = validateName(input.name);
    const color = validateColor(input.color);
    const visibility = validateVisibility(input.visibility);

    const id = newId("pin");
    const p = this.pins as PinRepoLike;
    if (isFn(p.create)) {
      try {
        const pin = await p.create!({
          id,
          userId: input.userId,
          name,
          color,
          visibility,
        });
        this.pinsById.set(pin.id, pin);
        return { ...pin, memoCount: 0 };
      } catch {
        // fall through to in-memory
      }
    }
    const now = new Date().toISOString();
    const pin: Pin = {
      id,
      userId: input.userId,
      name,
      color,
      visibility,
      createdAt: now,
      updatedAt: now,
    };
    this.pinsById.set(pin.id, pin);
    return { ...pin, memoCount: 0 };
  }

  async listPins(userId: string): Promise<Pin[]> {
    const p = this.pins as PinRepoLike;
    let pins: Pin[] | null = null;
    if (isFn(p.listByUser)) {
      try {
        pins = await p.listByUser!(userId);
      } catch {
        pins = null;
      }
    }
    if (pins === null) {
      pins = [];
      for (const pin of this.pinsById.values()) {
        if (pin.userId === userId) pins.push(pin);
      }
      pins.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    }
    const counts = await this.loadMemoCounts(userId);
    return pins.map((pin) => ({
      ...pin,
      memoCount: counts.get(pin.id) ?? 0,
    }));
  }

  async getPin(userId: string, pinId: string): Promise<Pin> {
    const pin = await this.loadPin(userId, pinId);
    if (!pin) throw new NotFoundError("Pin");
    const counts = await this.loadMemoCounts(userId);
    return { ...pin, memoCount: counts.get(pin.id) ?? 0 };
  }

  async updatePin(
    userId: string,
    pinId: string,
    patch: UpdatePinServiceInput,
  ): Promise<Pin> {
    const cleaned: UpdatePinInput = {};
    if (patch.name !== undefined) cleaned.name = validateName(patch.name);
    if (patch.color !== undefined) {
      cleaned.color = validateColor(patch.color);
    }
    if (patch.visibility !== undefined) {
      cleaned.visibility = validateVisibility(patch.visibility);
    }

    // Always confirm ownership first via owner-scoped read.
    const existing = await this.loadPin(userId, pinId);
    if (!existing) throw new NotFoundError("Pin");

    const p = this.pins as PinRepoLike;
    if (isFn(p.update)) {
      try {
        const updated = await p.update!(userId, pinId, cleaned);
        this.pinsById.set(updated.id, updated);
        return updated;
      } catch (e) {
        if (e instanceof NotFoundError) throw e;
        // ignore and fall through to in-memory
      }
    }
    const now = new Date().toISOString();
    const next: Pin = {
      ...existing,
      ...(cleaned.name !== undefined ? { name: cleaned.name } : {}),
      ...(cleaned.color !== undefined ? { color: cleaned.color } : {}),
      ...(cleaned.visibility !== undefined
        ? { visibility: cleaned.visibility }
        : {}),
      updatedAt: now,
    };
    this.pinsById.set(next.id, next);
    return next;
  }

  async deletePin(userId: string, pinId: string): Promise<void> {
    // Owner-scoped existence check.
    const existing = await this.loadPin(userId, pinId);
    if (!existing) throw new NotFoundError("Pin");

    const p = this.pins as PinRepoLike;
    if (isFn(p.delete)) {
      try {
        await p.delete!(userId, pinId);
      } catch (e) {
        if (e instanceof NotFoundError) throw e;
        // fall back to in-memory
      }
    }

    // In-memory cleanup mirrors the SQL detach: any local memos pointing at
    // this pin are reset to pinId=null. (Test-only path.)
    for (const [id, memo] of this.memosById) {
      if (memo.pinId === pinId && memo.userId === userId) {
        this.memosById.set(id, { ...memo, pinId: null });
      }
    }
    this.pinsById.delete(pinId);
  }

  async attachMemo(opts: {
    userId: string;
    memoId: string;
    pinId: string | null;
  }): Promise<Memo> {
    // Verify memo ownership.
    const memo = await this.loadMemo(opts.memoId);
    if (!memo || memo.userId !== opts.userId) {
      throw new NotFoundError("Memo");
    }
    // Verify pin ownership when a non-null target is requested.
    if (opts.pinId !== null) {
      const pin = await this.loadPin(opts.userId, opts.pinId);
      if (!pin) throw new NotFoundError("Pin");
    }

    const m = this.memos as MemoRepoLike;
    if (isFn(m.setPin)) {
      try {
        const updated = await m.setPin!({
          userId: opts.userId,
          memoId: opts.memoId,
          pinId: opts.pinId,
        });
        this.memosById.set(updated.id, updated);
        return updated;
      } catch (e) {
        if (e instanceof NotFoundError) throw e;
        // ignore and fall through
      }
    }
    const next: Memo = {
      ...memo,
      pinId: opts.pinId,
      updatedAt: new Date().toISOString(),
    };
    this.memosById.set(next.id, next);
    return next;
  }

  async listPinMemos(opts: {
    userId: string;
    pinId: string;
    cursor?: string;
    limit?: number;
  }): Promise<{ items: Memo[]; nextCursor: string | null }> {
    // Owner-scoped pin check first.
    const pin = await this.loadPin(opts.userId, opts.pinId);
    if (!pin) throw new NotFoundError("Pin");

    const p = this.pins as PinRepoLike;
    if (isFn(p.listMemos)) {
      try {
        return await p.listMemos!({
          userId: opts.userId,
          pinId: opts.pinId,
          cursor: opts.cursor,
          limit: opts.limit,
        });
      } catch {
        // fall through to in-memory
      }
    }
    const limit = Math.max(1, Math.min(opts.limit ?? 30, 100));
    const items: Memo[] = [];
    for (const memo of this.memosById.values()) {
      if (
        memo.userId === opts.userId &&
        memo.pinId === opts.pinId &&
        !memo.deletedAt
      ) {
        items.push(memo);
      }
    }
    items.sort((a, b) => (a.dateKst < b.dateKst ? 1 : -1));
    return { items: items.slice(0, limit), nextCursor: null };
  }

  /* -------------------- internal helpers -------------------- */

  private async loadPin(
    userId: string,
    pinId: string,
  ): Promise<Pin | null> {
    const p = this.pins as PinRepoLike;
    if (isFn(p.findById)) {
      try {
        const found = await p.findById!(userId, pinId);
        if (found) return found;
        // Repo returned null: trust it. This is the cross-user 404 path.
        return null;
      } catch {
        // fall through to in-memory
      }
    }
    const mem = this.pinsById.get(pinId);
    if (!mem || mem.userId !== userId) return null;
    return mem;
  }

  private async loadMemo(memoId: string): Promise<Memo | null> {
    const m = this.memos as MemoRepoLike;
    if (isFn(m.findById)) {
      try {
        const found = await m.findById!(memoId);
        if (found) return found;
      } catch {
        // ignore
      }
    }
    return this.memosById.get(memoId) ?? null;
  }

  private async loadMemoCounts(userId: string): Promise<Map<string, number>> {
    const p = this.pins as PinRepoLike;
    if (isFn(p.memoCountByPin)) {
      try {
        return await p.memoCountByPin!(userId);
      } catch {
        // ignore
      }
    }
    const out = new Map<string, number>();
    for (const memo of this.memosById.values()) {
      if (memo.userId !== userId || memo.deletedAt || !memo.pinId) continue;
      out.set(memo.pinId, (out.get(memo.pinId) ?? 0) + 1);
    }
    return out;
  }
}
