import { describe, it, expect } from "vitest";
import { Hono } from "hono";
import { authRoutes } from "../../src/routes/auth";

function mkApp() {
  const app = new Hono();
  app.route("/auth", authRoutes);
  return app;
}

function signupBody(over: Partial<{
  email: string;
  password: string;
  displayName: string;
}> = {}) {
  return {
    email: "alice@example.com",
    password: "Secret123!",
    displayName: "Alice",
    ...over,
  };
}

describe("auth routes (happy path expectations)", () => {
  it("POST /auth/signup with valid input returns 200 + user + tokens", async () => {
    const app = mkApp();
    const res = await app.request("/auth/signup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(signupBody()),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.user?.email).toBe("alice@example.com");
    expect(body.user?.displayName).toBe("Alice");
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

describe("auth routes — display name (필명)", () => {
  it("POST /auth/signup without displayName returns 400", async () => {
    const app = mkApp();
    const res = await app.request("/auth/signup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "noname@example.com",
        password: "Secret123!",
      }),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as any;
    expect(body.error?.code).toBe("VALIDATION_FAILED");
  });

  it("POST /auth/signup with too-short displayName returns 400", async () => {
    const app = mkApp();
    const res = await app.request("/auth/signup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(signupBody({
        email: "short@example.com",
        displayName: "A",
      })),
    });
    expect(res.status).toBe(400);
  });

  it("POST /auth/signup with duplicate displayName returns 409", async () => {
    const app = mkApp();
    const r1 = await app.request("/auth/signup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(signupBody({
        email: "first@example.com",
        displayName: "Penname",
      })),
    });
    expect(r1.status).toBe(200);

    const r2 = await app.request("/auth/signup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(signupBody({
        email: "second@example.com",
        displayName: "penname",
      })),
    });
    expect(r2.status).toBe(409);
    const body = (await r2.json()) as any;
    expect(body.error?.code).toBe("CONFLICT");
    expect(body.error?.details?.field).toBe("displayName");
  });

  it("GET /auth/check-display-name returns available=true for free name", async () => {
    const app = mkApp();
    const res = await app.request("/auth/check-display-name?name=Newname");
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.available).toBe(true);
  });

  it("GET /auth/check-display-name returns available=false reason=taken", async () => {
    const app = mkApp();
    await app.request("/auth/signup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(signupBody({
        email: "owner@example.com",
        displayName: "TakenName",
      })),
    });
    const res = await app.request(
      "/auth/check-display-name?name=takenname",
    );
    const body = (await res.json()) as any;
    expect(body.available).toBe(false);
    expect(body.reason).toBe("taken");
  });

  it("GET /auth/check-display-name flags invalid_chars", async () => {
    const app = mkApp();
    const res = await app.request(
      "/auth/check-display-name?name=" + encodeURIComponent("hey!"),
    );
    const body = (await res.json()) as any;
    expect(body.available).toBe(false);
    expect(body.reason).toBe("invalid_chars");
  });
});
