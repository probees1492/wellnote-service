import { describe, it, expect } from "vitest";
import { Hono } from "hono";
import { streakRoutes, _resetStreakServiceForTests } from "../../src/routes/streak";

function mkApp() {
  _resetStreakServiceForTests();
  const app = new Hono();
  app.route("/streak", streakRoutes);
  return app;
}

describe("streak routes", () => {
  const authHeaders = { Authorization: "Bearer test-user-1" };

  it("GET /streak/status returns initial streak snapshot for a fresh user", async () => {
    const app = mkApp();
    const res = await app.request("/streak/status", { headers: authHeaders });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body).toMatchObject({
      current: 0,
      longest: 0,
      lastDay: null,
    });
    expect(typeof body.freezes).toBe("number");
    expect(body.freezes).toBeGreaterThanOrEqual(0);
    expect(body.nextMilestone).toBe(3);
    expect(body.daysToNextMilestone).toBe(3);
  });

  it("GET /streak/status without auth returns 401", async () => {
    const app = mkApp();
    const res = await app.request("/streak/status");
    expect(res.status).toBe(401);
  });
});
