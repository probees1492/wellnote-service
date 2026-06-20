import { test, expect, type Page, type Route } from "@playwright/test";

// These tests stub the API and auth so they can run without a live backend.

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
  accessTokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  refreshTokenExpiresAt: new Date(
    Date.now() + 7 * 24 * 60 * 60 * 1000,
  ).toISOString(),
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

async function seedAuth(page: Page) {
  await page.addInitScript(
    ({ user, tokens }) => {
      try {
        window.localStorage.setItem("wn:user", JSON.stringify(user));
        window.localStorage.setItem("wn:access", tokens.accessToken);
        window.localStorage.setItem("wn:refresh", tokens.refreshToken);
        window.localStorage.setItem("wn:mode", "persistent");
      } catch {
        /* ignore */
      }
    },
    { user: fakeUser, tokens: fakeTokens },
  );
}

async function stubApi(page: Page) {
  const json = (route: Route, body: unknown, status = 200) =>
    route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(body),
    });

  await page.route("**/auth/me", (route) => json(route, { user: fakeUser }));
  await page.route("**/memos/today", (route) => json(route, fakeMemo));
  await page.route("**/memos/memo_e2e", (route) =>
    json(route, { ...fakeMemo, body: "", updatedAt: new Date().toISOString() }),
  );
  await page.route("**/activity/grid", (route) =>
    json(route, { cells: [], year: 2026 }),
  );
  await page.route("**/credit/balance", (route) => json(route, { balance: 100 }));
}

test.describe("Voice-to-text (Web Speech API)", () => {
  test("mic button renders and is enabled in Chromium", async ({ page }) => {
    await seedAuth(page);
    await stubApi(page);

    await page.goto("/app/today");
    const editor = page.getByTestId("memo-editor");
    await expect(editor).toBeVisible();
    await expect(editor).toHaveAttribute("data-ready", "true", {
      timeout: 10_000,
    });

    const btn = page.getByTestId("stt-button");
    await expect(btn).toBeVisible();
    // Chromium exposes webkitSpeechRecognition, so the button should be idle.
    await expect(btn).toHaveAttribute("data-state", "idle");
    await expect(btn).not.toBeDisabled();
    await expect(btn).toHaveAttribute("title", "음성 입력 시작");
  });

  test("mic button is disabled when SpeechRecognition is unavailable (Firefox simulation)", async ({
    page,
  }) => {
    // Remove Web Speech API before any app script runs.
    await page.addInitScript(() => {
      try {
        Object.defineProperty(window, "webkitSpeechRecognition", {
          value: undefined,
          configurable: true,
        });
        Object.defineProperty(window, "SpeechRecognition", {
          value: undefined,
          configurable: true,
        });
      } catch {
        /* ignore */
      }
    });
    await seedAuth(page);
    await stubApi(page);

    await page.goto("/app/today");
    const editor = page.getByTestId("memo-editor");
    await expect(editor).toBeVisible();

    const btn = page.getByTestId("stt-button");
    await expect(btn).toBeVisible();
    await expect(btn).toHaveAttribute("data-state", "unsupported");
    await expect(btn).toBeDisabled();
    await expect(btn).toHaveAttribute(
      "title",
      "이 브라우저는 음성 입력을 지원하지 않습니다",
    );
  });
});
