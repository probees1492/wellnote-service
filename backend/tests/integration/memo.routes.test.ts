import { describe, it, expect } from "vitest";
import { Hono } from "hono";
import { memoRoutes } from "../../src/routes/memos";

function mkApp() {
  const app = new Hono();
  app.route("/memos", memoRoutes);
  return app;
}

describe("memo routes", () => {
  it("GET /memos/today without auth returns 401", async () => {
    const app = mkApp();
    const res = await app.request("/memos/today");
    expect(res.status).toBe(401);
  });

  it("PATCH /memos/:id round-trip: write then read returns the body", async () => {
    const app = mkApp();
    const headers = {
      "content-type": "application/json",
      Authorization: "Bearer test-user-1",
    };
    // create/get today memo
    const today = await (await app.request("/memos/today", { headers })).json() as any;
    expect(today.id).toBeTypeOf("string");

    // patch body
    const patch = await app.request(`/memos/${today.id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ body: "안녕하세요" }),
    });
    expect(patch.status).toBe(200);

    // re-fetch
    const got = await (await app.request(`/memos/${today.id}`, { headers })).json() as any;
    expect(got.body).toBe("안녕하세요");
    expect(got.charCount).toBe("안녕하세요".length);
  });

  it("PATCH on a readonly memo returns 403 READ_ONLY_MEMO", async () => {
    const app = mkApp();
    const headers = {
      "content-type": "application/json",
      Authorization: "Bearer test-user-1",
    };
    // assume backend supplies a fixture memo id 'readonly-memo' for the test user
    const res = await app.request("/memos/readonly-memo", {
      method: "PATCH",
      headers,
      body: JSON.stringify({ body: "shouldn't work" }),
    });
    expect(res.status).toBe(403);
    const body = (await res.json()) as any;
    expect(body.error?.code).toBe("READ_ONLY_MEMO");
  });

  it("GET /memos/:id without auth returns 401", async () => {
    const app = mkApp();
    const res = await app.request("/memos/any-id");
    expect(res.status).toBe(401);
  });
});
