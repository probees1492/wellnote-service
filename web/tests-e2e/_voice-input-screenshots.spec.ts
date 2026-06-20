import { test, expect, type Page, type Route } from "@playwright/test";

// Visual snapshots of the today page mic button across themes and states.
// Underscore-prefixed so it groups with other design-only suites.

const NOW = new Date().toISOString();

const fakeUser = {
  id: "user_e2e",
  email: "voice@example.com",
  displayName: "Voice Tester",
  role: "user" as const,
  creditBalance: 100,
  isSuspended: false,
  emailVerifiedAt: null,
  createdAt: NOW,
  updatedAt: NOW,
};
const fakeTokens = {
  accessToken: "access_e2e",
  refreshToken: "refresh_e2e",
  accessTokenExpiresAt: new Date(Date.now() + 3600_000).toISOString(),
  refreshTokenExpiresAt: new Date(Date.now() + 86400_000).toISOString(),
};
const fakeMemo = {
  id: "memo_e2e",
  userId: fakeUser.id,
  dateKst: "2026-06-20",
  title: "",
  charCount: 0,
  r2ObjectKey: "memos/user_e2e/2026/06/20",
  encryptedDek: "",
  dekAlgo: "AES-GCM",
  iv: "",
  bodySha256: null,
  isReadonly: false,
  readonlyAt: null,
  deletedAt: null,
  createdAt: NOW,
  updatedAt: NOW,
  body: "",
};

async function setupPage(page: Page, mode: "light" | "dark") {
  await page.addInitScript(
    ({ user, tokens, m }) => {
      try {
        window.localStorage.setItem("wn:user", JSON.stringify(user));
        window.localStorage.setItem("wn:access", tokens.accessToken);
        window.localStorage.setItem("wn:refresh", tokens.refreshToken);
        window.localStorage.setItem("wn:mode", "persistent");
        window.localStorage.setItem("theme", m);
      } catch {
        /* ignore */
      }
    },
    { user: fakeUser, tokens: fakeTokens, m: mode },
  );

  const json = (route: Route, body: unknown, status = 200) =>
    route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  await page.route("**/auth/me", (route) => json(route, { user: fakeUser }));
  await page.route("**/memos/today", (route) => json(route, fakeMemo));
  await page.route("**/memos/memo_e2e", (route) =>
    json(route, { ...fakeMemo, updatedAt: new Date().toISOString() }),
  );
  await page.route("**/activity/grid", (route) =>
    json(route, { cells: [], year: 2026 }),
  );
  await page.route("**/credit/balance", (route) =>
    json(route, { balance: 100 }),
  );
}

test.describe("voice-input snapshots", () => {
  for (const mode of ["light", "dark"] as const) {
    test(`today page with mic button — ${mode}`, async ({ page }) => {
      await setupPage(page, mode);
      await page.goto("/app/today");
      await page.evaluate((m) => {
        document.documentElement.classList.toggle("dark", m === "dark");
      }, mode);
      const editor = page.getByTestId("memo-editor");
      await expect(editor).toBeVisible();
      await expect(page.getByTestId("stt-button")).toBeVisible();
      await page.screenshot({
        path: `test-results/design/${mode}-04-today-mic.png`,
        fullPage: true,
      });
    });
  }
});
