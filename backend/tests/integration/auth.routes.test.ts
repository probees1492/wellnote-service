import { describe, it, expect } from "vitest";
import { Hono } from "hono";
import { authRoutes } from "../../src/routes/auth";

function mkApp() {
  const app = new Hono();
  app.route("/auth", authRoutes);
  return app;
}

describe("auth routes (happy path expectations)", () => {
  it("POST /auth/signup with valid input returns 200 + user + tokens", async () => {
    const app = mkApp();
    const res = await app.request("/auth/signup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "alice@example.com",
        password: "Secret123!",
        displayName: "Alice",
      }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.user?.email).toBe("alice@example.com");
    expect(body.tokens?.accessToken).toBeTypeOf("string");
    expect(body.tokens?.refreshToken).toBeTypeOf("string");
  });

  it("POST /auth/login with bad password returns 401", async () => {
    const app = mkApp();
    const res = await app.request("/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "alice@example.com", password: "wrong" }),
    });
    expect(res.status).toBe(401);
    const body = (await res.json()) as any;
    expect(body.error?.code).toBe("UNAUTHORIZED");
  });

  it("GET /auth/me without Authorization returns 401", async () => {
    const app = mkApp();
    const res = await app.request("/auth/me");
    expect(res.status).toBe(401);
  });

  it("POST /auth/refresh with invalid refresh returns 401", async () => {
    const app = mkApp();
    const res = await app.request("/auth/refresh", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ refreshToken: "invalid" }),
    });
    expect(res.status).toBe(401);
  });
});
