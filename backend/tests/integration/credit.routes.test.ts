import { describe, it, expect } from "vitest";
import { Hono } from "hono";
import { creditRoutes } from "../../src/routes/credits";

function mkApp() {
  const app = new Hono();
  app.route("/credit", creditRoutes);
  return app;
}

describe("credit routes", () => {
  const authHeaders = { Authorization: "Bearer test-user-1" };

  it("GET /credit/balance returns numeric balance for authed user", async () => {
    const app = mkApp();
    const res = await app.request("/credit/balance", { headers: authHeaders });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(typeof body.balance).toBe("number");
    expect(body.balance).toBeGreaterThanOrEqual(0);
  });

  it("GET /credit/balance without auth returns 401", async () => {
    const app = mkApp();
    const res = await app.request("/credit/balance");
    expect(res.status).toBe(401);
  });

  it("GET /credit/transactions returns paginated list", async () => {
    const app = mkApp();
    const res = await app.request("/credit/transactions?limit=10", {
      headers: authHeaders,
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(Array.isArray(body.items)).toBe(true);
    expect(body).toHaveProperty("nextCursor");
  });
});
