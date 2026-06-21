import { describe, it, expect } from "vitest";
import { Hono } from "hono";
import { authRoutes, memUsers, memUsersByEmail } from "../../src/routes/auth";
import { userRoutes } from "../../src/routes/users";

function mkApp() {
  const app = new Hono();
  app.route("/auth", authRoutes);
  app.route("/users", userRoutes);
  return app;
}

async function signup(
  app: Hono,
  email: string,
  displayName: string,
): Promise<{ token: string; userId: string }> {
  const res = await app.request("/auth/signup", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email,
      password: "Secret123!",
      displayName,
    }),
  });
  expect(res.status).toBe(200);
  const body = (await res.json()) as any;
  return {
    token: body.tokens.accessToken as string,
    userId: body.user.id as string,
  };
}

function rewindCooldown(userId: string, hoursAgo: number) {
  const u = memUsers.get(userId);
  if (!u) throw new Error("user not found");
  if (!u.displayNameChangedAt) return;
  u.displayNameChangedAt = new Date(
    Date.parse(u.displayNameChangedAt) - hoursAgo * 60 * 60 * 1000,
  ).toISOString();
}

describe("PATCH /users/me/display-name (필명 수정)", () => {
  it("renames + stamps displayNameChangedAt", async () => {
    const app = mkApp();
    const { token, userId } = await signup(app, "rename1@x.com", "Origin");
    const res = await app.request("/users/me/display-name", {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ displayName: "Renamed" }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.user.displayName).toBe("Renamed");
    expect(body.user.displayNameChangedAt).toBeTypeOf("string");
    expect(memUsers.get(userId)?.displayName).toBe("Renamed");
  });

  it("rejects duplicate display name with 409", async () => {
    const app = mkApp();
    await signup(app, "owner@x.com", "TakenPen");
    const { token } = await signup(app, "renamer@x.com", "MyName");
    const res = await app.request("/users/me/display-name", {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ displayName: "takenpen" }),
    });
    expect(res.status).toBe(409);
    const body = (await res.json()) as any;
    expect(body.error?.code).toBe("CONFLICT");
    expect(body.error?.details?.field).toBe("displayName");
  });

  it("enforces 24h cooldown after a rename", async () => {
    const app = mkApp();
    const { token } = await signup(app, "cooldown@x.com", "First");
    const r1 = await app.request("/users/me/display-name", {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ displayName: "Second" }),
    });
    expect(r1.status).toBe(200);
    const r2 = await app.request("/users/me/display-name", {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ displayName: "Third" }),
    });
    expect(r2.status).toBe(429);
    const body = (await r2.json()) as any;
    expect(body.error?.code).toBe("RATE_LIMITED");
    expect(body.error?.details?.retryAt).toBeTypeOf("string");
  });

  it("allows rename after the cooldown expires", async () => {
    const app = mkApp();
    const { token, userId } = await signup(app, "cooled@x.com", "First2");
    const r1 = await app.request("/users/me/display-name", {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ displayName: "Second2" }),
    });
    expect(r1.status).toBe(200);
    // Pretend the change happened > 24h ago.
    rewindCooldown(userId, 25);
    const r2 = await app.request("/users/me/display-name", {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ displayName: "Third2" }),
    });
    expect(r2.status).toBe(200);
  });

  it("no-op when the requested name matches the current one (cooldown not consumed)", async () => {
    const app = mkApp();
    const { token, userId } = await signup(app, "noop@x.com", "Stable");
    const res = await app.request("/users/me/display-name", {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ displayName: "stable" }),
    });
    expect(res.status).toBe(200);
    // The original signup did NOT stamp displayNameChangedAt (only renames do),
    // so the field remains null and no cooldown is triggered.
    expect(memUsers.get(userId)?.displayNameChangedAt).toBe(null);
  });

  it("rejects invalid characters with 400", async () => {
    const app = mkApp();
    const { token } = await signup(app, "invalid@x.com", "Init");
    const res = await app.request("/users/me/display-name", {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ displayName: "bad!name" }),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as any;
    expect(body.error?.details?.reason).toBe("invalid_chars");
  });

  it("requires auth", async () => {
    const app = mkApp();
    const res = await app.request("/users/me/display-name", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ displayName: "Anon" }),
    });
    expect(res.status).toBe(401);
  });
});

// Silence unused-import lint when memUsersByEmail isn't referenced directly.
void memUsersByEmail;

describe("avatar routes", () => {
  function jpegBytes(n: number): ArrayBuffer {
    const buf = new Uint8Array(n);
    buf[0] = 0xff;
    buf[1] = 0xd8;
    buf[2] = 0xff;
    return buf.buffer;
  }

  it("PUT /users/me/avatar stores bytes and exposes avatarUrl", async () => {
    const app = mkApp();
    const { token, userId } = await signup(app, "avatar@x.com", "AvatarUser");
    const res = await app.request("/users/me/avatar", {
      method: "PUT",
      headers: {
        "content-type": "image/jpeg",
        authorization: `Bearer ${token}`,
      },
      body: jpegBytes(512),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.user.avatarUrl).toMatch(
      new RegExp(`^/users/${userId}/avatar\\?v=`),
    );
    expect(body.user.avatarUpdatedAt).toBeTypeOf("string");
  });

  it("GET /users/:userId/avatar streams the stored bytes", async () => {
    const app = mkApp();
    const { token, userId } = await signup(app, "avatar2@x.com", "AvatarTwo");
    await app.request("/users/me/avatar", {
      method: "PUT",
      headers: {
        "content-type": "image/png",
        authorization: `Bearer ${token}`,
      },
      body: jpegBytes(64),
    });
    const res = await app.request(`/users/${userId}/avatar`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");
    expect(res.headers.get("cache-control")).toMatch(/max-age=3600/);
    const bytes = new Uint8Array(await res.arrayBuffer());
    expect(bytes.length).toBe(64);
  });

  it("DELETE /users/me/avatar clears the avatar fields", async () => {
    const app = mkApp();
    const { token } = await signup(app, "avatar3@x.com", "AvatarThree");
    await app.request("/users/me/avatar", {
      method: "PUT",
      headers: {
        "content-type": "image/jpeg",
        authorization: `Bearer ${token}`,
      },
      body: jpegBytes(32),
    });
    const res = await app.request("/users/me/avatar", {
      method: "DELETE",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.user.avatarUrl).toBe(null);
    expect(body.user.avatarUpdatedAt).toBe(null);
  });

  it("rejects unsupported content-types with 400", async () => {
    const app = mkApp();
    const { token } = await signup(app, "badmime@x.com", "BadMime");
    const res = await app.request("/users/me/avatar", {
      method: "PUT",
      headers: {
        "content-type": "image/gif",
        authorization: `Bearer ${token}`,
      },
      body: jpegBytes(8),
    });
    expect(res.status).toBe(400);
  });

  it("rejects oversized bodies with 413", async () => {
    const app = mkApp();
    const { token } = await signup(app, "huge@x.com", "Huge");
    const res = await app.request("/users/me/avatar", {
      method: "PUT",
      headers: {
        "content-type": "image/jpeg",
        authorization: `Bearer ${token}`,
      },
      body: jpegBytes(3 * 1024 * 1024),
    });
    expect(res.status).toBe(413);
  });

  it("avatar fetch 404 when never uploaded", async () => {
    const app = mkApp();
    const { userId } = await signup(app, "noavatar@x.com", "NoAvatar");
    const res = await app.request(`/users/${userId}/avatar`);
    expect(res.status).toBe(404);
  });
});
