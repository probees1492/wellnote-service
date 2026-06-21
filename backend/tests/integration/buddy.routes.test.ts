import { describe, it, expect, beforeEach } from "vitest";
import { Hono } from "hono";
import { authRoutes, memUsers, memUsersByEmail } from "../../src/routes/auth";
import { _resetBuddyRepoForTests, buddyRoutes } from "../../src/routes/buddies";

function mkApp() {
  _resetBuddyRepoForTests();
  memUsers.clear();
  memUsersByEmail.clear();
  const app = new Hono();
  app.route("/auth", authRoutes);
  app.route("/buddies", buddyRoutes);
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

describe("buddy routes — search + follow + visibility", () => {
  let appCache: Hono;
  beforeEach(() => {
    appCache = mkApp();
  });

  it("GET /buddies/search by display-name prefix", async () => {
    const app = appCache;
    const a = await signup(app, "alpha@x.com", "Alpha");
    await signup(app, "bravo@x.com", "Bravo");
    await signup(app, "alex@x.com", "Alex");

    const res = await app.request("/buddies/search?q=al", {
      headers: { authorization: `Bearer ${a.token}` },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    const names = body.items.map((p: any) => p.displayName).sort();
    // Alpha is the caller, so it's excluded; Alex matches "al" prefix.
    expect(names).toEqual(["Alex"]);
  });

  it("POST /buddies/follow then DELETE — counts and exists flip", async () => {
    const app = appCache;
    const a = await signup(app, "follower@x.com", "Follower");
    const b = await signup(app, "followee@x.com", "Followee");

    const follow = await app.request(`/buddies/follow/${b.userId}`, {
      method: "POST",
      headers: { authorization: `Bearer ${a.token}` },
    });
    expect(follow.status).toBe(200);
    const followBody = (await follow.json()) as any;
    expect(followBody.buddy.isFollowing).toBe(true);
    expect(followBody.buddy.followerCount).toBe(1);

    const me = await app.request("/buddies/me/following", {
      headers: { authorization: `Bearer ${a.token}` },
    });
    const meBody = (await me.json()) as any;
    expect(meBody.items.map((p: any) => p.displayName)).toEqual(["Followee"]);

    const unfollow = await app.request(`/buddies/follow/${b.userId}`, {
      method: "DELETE",
      headers: { authorization: `Bearer ${a.token}` },
    });
    expect(unfollow.status).toBe(200);
    const unfollowBody = (await unfollow.json()) as any;
    expect(unfollowBody.buddy.isFollowing).toBe(false);
    expect(unfollowBody.buddy.followerCount).toBe(0);
  });

  it("POST /buddies/follow on self returns 400", async () => {
    const app = appCache;
    const a = await signup(app, "self@x.com", "Selfie");
    const res = await app.request(`/buddies/follow/${a.userId}`, {
      method: "POST",
      headers: { authorization: `Bearer ${a.token}` },
    });
    expect(res.status).toBe(400);
  });

  it("PUT /buddies/me/visibility flips private; other user gets 403", async () => {
    const app = appCache;
    const a = await signup(app, "viewer@x.com", "Viewer");
    const b = await signup(app, "target@x.com", "Target");

    // b sets visibility to private
    const setRes = await app.request("/buddies/me/visibility", {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${b.token}`,
      },
      body: JSON.stringify({ followingVisibility: "private" }),
    });
    expect(setRes.status).toBe(200);

    // a peeks b's following list -> 403
    const peek = await app.request(`/buddies/${b.userId}/following`, {
      headers: { authorization: `Bearer ${a.token}` },
    });
    expect(peek.status).toBe(403);

    // b can still see their own list
    const self = await app.request(`/buddies/${b.userId}/following`, {
      headers: { authorization: `Bearer ${b.token}` },
    });
    expect(self.status).toBe(200);
  });

  it("GET /buddies/me/followers returns those who follow me", async () => {
    const app = appCache;
    const a = await signup(app, "f1@x.com", "F1");
    const b = await signup(app, "f2@x.com", "F2");
    const c = await signup(app, "target@x.com", "Target");

    for (const t of [a.token, b.token]) {
      const res = await app.request(`/buddies/follow/${c.userId}`, {
        method: "POST",
        headers: { authorization: `Bearer ${t}` },
      });
      expect(res.status).toBe(200);
    }
    const followers = await app.request("/buddies/me/followers", {
      headers: { authorization: `Bearer ${c.token}` },
    });
    const body = (await followers.json()) as any;
    expect(body.items).toHaveLength(2);
    expect(body.items.map((p: any) => p.displayName).sort()).toEqual([
      "F1",
      "F2",
    ]);
  });

  it("public-following-list flow: A → B → A reads C through B", async () => {
    const app = appCache;
    const a = await signup(app, "a@x.com", "Reader");
    const b = await signup(app, "b@x.com", "Bridge");
    const c = await signup(app, "c@x.com", "Edge");

    // B follows C
    await app.request(`/buddies/follow/${c.userId}`, {
      method: "POST",
      headers: { authorization: `Bearer ${b.token}` },
    });
    // A peeks B's following list (default public) and sees C.
    const peek = await app.request(`/buddies/${b.userId}/following`, {
      headers: { authorization: `Bearer ${a.token}` },
    });
    expect(peek.status).toBe(200);
    const body = (await peek.json()) as any;
    expect(body.items.map((p: any) => p.id)).toContain(c.userId);
  });
});
