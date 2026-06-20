import { describe, it, expect } from "vitest";
import { Hono } from "hono";
import { adminRoutes } from "../../src/routes/admin";

function mkApp() {
  const app = new Hono();
  app.route("/admin", adminRoutes);
  return app;
}

describe("admin routes", () => {
  it("GET /admin/users requires admin role: 403 for plain user", async () => {
    const app = mkApp();
    const res = await app.request("/admin/users", {
      headers: { Authorization: "Bearer test-user-1" },
    });
    expect(res.status).toBe(403);
  });

  it("GET /admin/users with admin token returns paginated list", async () => {
    const app = mkApp();
    const res = await app.request("/admin/users?limit=50", {
      headers: { Authorization: "Bearer test-admin-1" },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(Array.isArray(body.items)).toBe(true);
  });

  it("POST /admin/users/:id/credit/grant applies positive delta", async () => {
    const app = mkApp();
    const res = await app.request("/admin/users/target-user-1/credit/grant", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        Authorization: "Bearer test-admin-1",
      },
      body: JSON.stringify({ amount: 30, reason: "신규 캠페인 참여 보상입니다" }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.delta).toBe(30);
    expect(typeof body.balanceAfter).toBe("number");
  });

  it("POST credit/revoke with amount > balance clamps and reports actual delta", async () => {
    const app = mkApp();
    const res = await app.request("/admin/users/target-user-1/credit/revoke", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        Authorization: "Bearer test-admin-1",
      },
      body: JSON.stringify({ amount: 99999, reason: "환불 처리에 따른 회수입니다" }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.requested).toBe(99999);
    expect(body.delta).toBeLessThanOrEqual(0);
    expect(body.balanceAfter).toBe(0);
  });

  it("POST credit/grant rejects missing reason (validation 400)", async () => {
    const app = mkApp();
    const res = await app.request("/admin/users/target-user-1/credit/grant", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        Authorization: "Bearer test-admin-1",
      },
      body: JSON.stringify({ amount: 30 }),
    });
    expect(res.status).toBe(400);
  });
});
