import { describe, it, expect } from "vitest";
import { DefaultPinService } from "../../src/services/pin.service";
import { NotFoundError, ValidationError } from "../../src/lib/errors";
import type { PinRepo } from "../../src/repositories/pin.repo";
import type { MemoRepo } from "../../src/repositories/memo.repo";
import type { Pin } from "../../src/domain/pin";
import type { Memo } from "../../src/domain/memo";
import { makeMemo, TODAY_KST } from "../helpers/fixtures";

function makeRepos(seed: { pins?: Pin[]; memos?: Memo[] } = {}) {
  const pinStore = new Map<string, Pin>();
  for (const p of seed.pins ?? []) pinStore.set(p.id, { ...p });
  const memoStore = new Map<string, Memo>();
  for (const m of seed.memos ?? []) memoStore.set(m.id, { ...m });

  const pinRepo: PinRepo = {
    async create(input) {
      const now = new Date().toISOString();
      const pin: Pin = {
        id: input.id,
        userId: input.userId,
        name: input.name,
        color: input.color ?? "slate",
        visibility: input.visibility ?? "private",
        createdAt: now,
        updatedAt: now,
      };
      pinStore.set(pin.id, pin);
      return pin;
    },
    async findById(userId, pinId) {
      const p = pinStore.get(pinId);
      if (!p || p.userId !== userId) return null;
      return p;
    },
    async listByUser(userId) {
      const items: Pin[] = [];
      for (const p of pinStore.values()) {
        if (p.userId === userId) items.push(p);
      }
      items.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
      return items;
    },
    async update(userId, pinId, patch) {
      const p = pinStore.get(pinId);
      if (!p || p.userId !== userId) throw new NotFoundError("Pin");
      const next: Pin = {
        ...p,
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.color !== undefined ? { color: patch.color } : {}),
        ...(patch.visibility !== undefined
          ? { visibility: patch.visibility }
          : {}),
        updatedAt: new Date().toISOString(),
      };
      pinStore.set(next.id, next);
      return next;
    },
    async delete(userId, pinId) {
      const p = pinStore.get(pinId);
      if (!p || p.userId !== userId) throw new NotFoundError("Pin");
      // detach
      for (const [id, memo] of memoStore) {
        if (memo.userId === userId && memo.pinId === pinId) {
          memoStore.set(id, { ...memo, pinId: null });
        }
      }
      pinStore.delete(pinId);
    },
    async listMemos(opts) {
      const items: Memo[] = [];
      for (const m of memoStore.values()) {
        if (
          m.userId === opts.userId &&
          m.pinId === opts.pinId &&
          !m.deletedAt
        ) {
          items.push(m);
        }
      }
      items.sort((a, b) => (a.dateKst < b.dateKst ? 1 : -1));
      const limit = opts.limit ?? 30;
      return { items: items.slice(0, limit), nextCursor: null };
    },
    async memoCountByPin(userId) {
      const out = new Map<string, number>();
      for (const m of memoStore.values()) {
        if (m.userId !== userId || m.deletedAt || !m.pinId) continue;
        out.set(m.pinId, (out.get(m.pinId) ?? 0) + 1);
      }
      return out;
    },
  };

  const memoRepo = {
    async findById(id: string) {
      return memoStore.get(id) ?? null;
    },
    async setPin(opts: {
      userId: string;
      memoId: string;
      pinId: string | null;
    }) {
      const m = memoStore.get(opts.memoId);
      if (!m || m.userId !== opts.userId) throw new NotFoundError("Memo");
      const next: Memo = {
        ...m,
        pinId: opts.pinId,
        updatedAt: new Date().toISOString(),
      };
      memoStore.set(next.id, next);
      return next;
    },
  } as unknown as MemoRepo;

  return {
    svc: new DefaultPinService(pinRepo, memoRepo),
    pinStore,
    memoStore,
  };
}

describe("PinService.createPin", () => {
  it("defaults color=slate and visibility=private", async () => {
    const { svc } = makeRepos();
    const pin = await svc.createPin({ userId: "u-1", name: "Reading list" });
    expect(pin.color).toBe("slate");
    expect(pin.visibility).toBe("private");
    expect(pin.name).toBe("Reading list");
    expect(pin.memoCount).toBe(0);
  });

  it("rejects empty pin name", async () => {
    const { svc } = makeRepos();
    await expect(
      svc.createPin({ userId: "u-1", name: "" }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects pin name longer than 40 chars", async () => {
    const { svc } = makeRepos();
    await expect(
      svc.createPin({ userId: "u-1", name: "x".repeat(41) }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects invalid color value", async () => {
    const { svc } = makeRepos();
    await expect(
      svc.createPin({
        userId: "u-1",
        name: "ok",
        color: "purple" as any,
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("accepts each of the five valid colors", async () => {
    const { svc } = makeRepos();
    for (const c of ["slate", "yellow", "red", "green", "blue"] as const) {
      const pin = await svc.createPin({
        userId: "u-1",
        name: `pin-${c}`,
        color: c,
      });
      expect(pin.color).toBe(c);
    }
  });
});

describe("PinService.listPins", () => {
  it("excludes other users' pins", async () => {
    const { svc } = makeRepos();
    await svc.createPin({ userId: "u-1", name: "mine" });
    await svc.createPin({ userId: "u-2", name: "theirs" });
    const r = await svc.listPins("u-1");
    expect(r).toHaveLength(1);
    expect(r[0].name).toBe("mine");
    expect(r[0].userId).toBe("u-1");
  });

  it("returns memoCount for each pin", async () => {
    const { svc, memoStore } = makeRepos();
    const pin = await svc.createPin({ userId: "u-1", name: "books" });
    memoStore.set(
      "m-1",
      makeMemo({ id: "m-1", userId: "u-1", pinId: pin.id, dateKst: TODAY_KST }),
    );
    memoStore.set(
      "m-2",
      makeMemo({ id: "m-2", userId: "u-1", pinId: pin.id, dateKst: "2026-06-19" }),
    );
    const r = await svc.listPins("u-1");
    expect(r[0].memoCount).toBe(2);
  });
});

describe("PinService.updatePin", () => {
  it("allows updating own pin", async () => {
    const { svc } = makeRepos();
    const pin = await svc.createPin({ userId: "u-1", name: "old" });
    const updated = await svc.updatePin("u-1", pin.id, {
      name: "new",
      color: "red",
    });
    expect(updated.name).toBe("new");
    expect(updated.color).toBe("red");
  });

  it("returns NotFoundError when another user tries to update", async () => {
    const { svc } = makeRepos();
    const pin = await svc.createPin({ userId: "u-1", name: "mine" });
    await expect(
      svc.updatePin("u-other", pin.id, { name: "hijack" }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("PinService.deletePin", () => {
  it("clears pin_id on memos belonging to that pin", async () => {
    const { svc, memoStore } = makeRepos();
    const pin = await svc.createPin({ userId: "u-1", name: "books" });
    const memoA = makeMemo({
      id: "m-a",
      userId: "u-1",
      pinId: pin.id,
      dateKst: TODAY_KST,
    });
    const memoB = makeMemo({
      id: "m-b",
      userId: "u-1",
      pinId: pin.id,
      dateKst: "2026-06-19",
    });
    memoStore.set(memoA.id, memoA);
    memoStore.set(memoB.id, memoB);

    await svc.deletePin("u-1", pin.id);
    expect(memoStore.get("m-a")!.pinId).toBe(null);
    expect(memoStore.get("m-b")!.pinId).toBe(null);
  });

  it("rejects deleting another user's pin", async () => {
    const { svc } = makeRepos();
    const pin = await svc.createPin({ userId: "u-1", name: "mine" });
    await expect(
      svc.deletePin("u-other", pin.id),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("PinService.attachMemo", () => {
  it("attaches a memo to a pin owned by the same user", async () => {
    const { svc, memoStore } = makeRepos();
    const pin = await svc.createPin({ userId: "u-1", name: "books" });
    memoStore.set(
      "m-1",
      makeMemo({ id: "m-1", userId: "u-1", dateKst: TODAY_KST }),
    );
    const updated = await svc.attachMemo({
      userId: "u-1",
      memoId: "m-1",
      pinId: pin.id,
    });
    expect(updated.pinId).toBe(pin.id);
  });

  it("rejects attaching another user's memo", async () => {
    const { svc, memoStore } = makeRepos();
    const pin = await svc.createPin({ userId: "u-1", name: "books" });
    memoStore.set(
      "m-1",
      makeMemo({ id: "m-1", userId: "u-other", dateKst: TODAY_KST }),
    );
    await expect(
      svc.attachMemo({ userId: "u-1", memoId: "m-1", pinId: pin.id }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("rejects attaching a memo to another user's pin", async () => {
    const { svc, memoStore } = makeRepos();
    const pin = await svc.createPin({ userId: "u-other", name: "theirs" });
    memoStore.set(
      "m-1",
      makeMemo({ id: "m-1", userId: "u-1", dateKst: TODAY_KST }),
    );
    await expect(
      svc.attachMemo({ userId: "u-1", memoId: "m-1", pinId: pin.id }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("pinId: null detaches the memo (idempotent)", async () => {
    const { svc, memoStore } = makeRepos();
    const pin = await svc.createPin({ userId: "u-1", name: "books" });
    memoStore.set(
      "m-1",
      makeMemo({
        id: "m-1",
        userId: "u-1",
        pinId: pin.id,
        dateKst: TODAY_KST,
      }),
    );
    const detached = await svc.attachMemo({
      userId: "u-1",
      memoId: "m-1",
      pinId: null,
    });
    expect(detached.pinId).toBeNull();
    // Calling again is a no-op (still null).
    const again = await svc.attachMemo({
      userId: "u-1",
      memoId: "m-1",
      pinId: null,
    });
    expect(again.pinId).toBeNull();
  });

  it("attaching the same memo to the same pin twice is idempotent", async () => {
    const { svc, memoStore } = makeRepos();
    const pin = await svc.createPin({ userId: "u-1", name: "books" });
    memoStore.set(
      "m-1",
      makeMemo({ id: "m-1", userId: "u-1", dateKst: TODAY_KST }),
    );
    await svc.attachMemo({ userId: "u-1", memoId: "m-1", pinId: pin.id });
    const r = await svc.attachMemo({
      userId: "u-1",
      memoId: "m-1",
      pinId: pin.id,
    });
    expect(r.pinId).toBe(pin.id);
  });
});

describe("PinService.listPinMemos", () => {
  it("excludes deleted memos from the listing", async () => {
    const { svc, memoStore } = makeRepos();
    const pin = await svc.createPin({ userId: "u-1", name: "books" });
    memoStore.set(
      "m-1",
      makeMemo({
        id: "m-1",
        userId: "u-1",
        pinId: pin.id,
        dateKst: TODAY_KST,
      }),
    );
    memoStore.set(
      "m-del",
      makeMemo({
        id: "m-del",
        userId: "u-1",
        pinId: pin.id,
        dateKst: "2026-06-18",
        deletedAt: "2026-06-19T00:00:00.000Z",
      }),
    );
    const r = await svc.listPinMemos({ userId: "u-1", pinId: pin.id });
    expect(r.items.map((m) => m.id)).toEqual(["m-1"]);
  });

  it("rejects access to another user's pin with NotFoundError", async () => {
    const { svc } = makeRepos();
    const pin = await svc.createPin({ userId: "u-1", name: "books" });
    await expect(
      svc.listPinMemos({ userId: "u-other", pinId: pin.id }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
