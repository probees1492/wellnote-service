import { describe, it, expect, beforeEach } from "vitest";
import { Hono } from "hono";
import { pinRoutes, _resetPinServiceForTests } from "../../src/routes/pins";
import { memoRoutes } from "../../src/routes/memos";

function mkApp() {
  _resetPinServiceForTests();
  const app = new Hono();
  app.route("/pins", pinRoutes);
  app.route("/memos", memoRoutes);
  return app;
}

const headers = (token = "test-user-pin") => ({
  "content-type": "application/json",
  Authorization: `Bearer ${token}`,
});

describe("pin routes — auth", () => {
  it("GET /pins without auth returns 401", async () => {
    const app = mkApp();
    const res = await app.request("/pins");
    expect(res.status).toBe(401);
  });

  it("POST /pins without auth returns 401", async () => {
    const app = mkApp();
    const res = await app.request("/pins", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "a" }),
    });
    expect(res.status).toBe(401);
  });
});

describe("pin routes — happy path round-trip", () => {
  it("create -> list -> get -> attach memo -> /pins/:id/memos -> detach -> delete", async () => {
    const app = mkApp();
    const h = headers("test-user-roundtrip");

    // 1) create pin
    const created = await (
      await app.request("/pins", {
        method: "POST",
        headers: h,
        body: JSON.stringify({
          name: "Daily reflections",
          color: "yellow",
          visibility: "private",
        }),
      })
    ).json() as any;
    expect(created.id).toBeTypeOf("string");
    expect(created.color).toBe("yellow");
    expect(created.visibility).toBe("private");
    expect(created.memoCount).toBe(0);

    // 2) list pins
    const list = await (
      await app.request("/pins", { headers: h })
    ).json() as any;
    expect(list.items.find((p: any) => p.id === created.id)).toBeTruthy();

    // 3) get pin details
    const detail = await (
      await app.request(`/pins/${created.id}`, { headers: h })
    ).json() as any;
    expect(detail.id).toBe(created.id);
    expect(detail.memoCount).toBe(0);

    // 4) create today's memo, attach to pin via /memos/:id/pin
    const memo = await (
      await app.request("/memos/today", { headers: h })
    ).json() as any;
    expect(memo.id).toBeTypeOf("string");

    const attached = await (
      await app.request(`/memos/${memo.id}/pin`, {
        method: "PATCH",
        headers: h,
        body: JSON.stringify({ pinId: created.id }),
      })
    ).json() as any;
    expect(attached.pinId).toBe(created.id);

    // 5) list memos for that pin
    const memos = await (
      await app.request(`/pins/${created.id}/memos`, { headers: h })
    ).json() as any;
    expect(memos.items.map((m: any) => m.id)).toContain(memo.id);

    // 6) detach via attach with pinId=null
    const detached = await (
      await app.request(`/memos/${memo.id}/pin`, {
        method: "PATCH",
        headers: h,
        body: JSON.stringify({ pinId: null }),
      })
    ).json() as any;
    expect(detached.pinId).toBeNull();

    // 7) delete pin
    const del = await app.request(`/pins/${created.id}`, {
      method: "DELETE",
      headers: h,
    });
    expect(del.status).toBe(200);

    // 8) subsequent GET returns 404
    const gone = await app.request(`/pins/${created.id}`, { headers: h });
    expect(gone.status).toBe(404);
  });
});

describe("pin routes — cross-user isolation", () => {
  it("another user receives 404 when reading my pin", async () => {
    const app = mkApp();
    const mine = headers("test-user-iso-a");
    const created = await (
      await app.request("/pins", {
        method: "POST",
        headers: mine,
        body: JSON.stringify({ name: "private stuff" }),
      })
    ).json() as any;
    const other = headers("test-user-iso-b");
    const res = await app.request(`/pins/${created.id}`, { headers: other });
    expect(res.status).toBe(404);
  });
});

describe("pin routes — validation", () => {
  it("POST /pins rejects empty name", async () => {
    const app = mkApp();
    const res = await app.request("/pins", {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ name: "" }),
    });
    expect(res.status).toBe(400);
  });

  it("POST /pins rejects unknown color", async () => {
    const app = mkApp();
    const res = await app.request("/pins", {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ name: "ok", color: "purple" }),
    });
    expect(res.status).toBe(400);
  });

  it("PATCH /pins/:id rejects empty body", async () => {
    const app = mkApp();
    const created = await (
      await app.request("/pins", {
        method: "POST",
        headers: headers("test-user-vpatch"),
        body: JSON.stringify({ name: "x" }),
      })
    ).json() as any;
    const res = await app.request(`/pins/${created.id}`, {
      method: "PATCH",
      headers: headers("test-user-vpatch"),
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });
});
