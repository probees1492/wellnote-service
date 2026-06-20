import { test, expect } from "@playwright/test";

const uniqueEmail = () =>
  `e2e_rm_${Date.now()}_${Math.floor(Math.random() * 1e6)}@example.com`;

test.describe("Remember Me + Google sign-in surfaces", () => {
  test("signup default (Remember Me on) -> tokens in localStorage", async ({
    page,
  }) => {
    const email = uniqueEmail();
    const password = "Passw0rd!";

    await page.goto("/signup");
    await expect(page.getByTestId("signup-remember")).toBeVisible();
    // Default is ON.
    await expect(page.getByTestId("signup-remember")).toBeChecked();

    await page.getByTestId("signup-email").fill(email);
    await page.getByTestId("signup-password").fill(password);
    await page.getByTestId("signup-confirm").fill(password);
    await page.getByTestId("signup-displayname").fill("E2E RM");
    await page.getByTestId("signup-submit").click();
    await page.waitForURL("**/app", { timeout: 10_000 });

    const localAccess = await page.evaluate(() =>
      window.localStorage.getItem("wn:access"),
    );
    const sessionAccess = await page.evaluate(() =>
      window.sessionStorage.getItem("wn:access"),
    );
    const mode = await page.evaluate(() =>
      window.localStorage.getItem("wn:mode"),
    );
    expect(localAccess).toBeTruthy();
    expect(sessionAccess).toBeNull();
    expect(mode).toBe("persistent");
  });

  test("login with Remember Me OFF -> tokens in sessionStorage only", async ({
    page,
  }) => {
    // First, create a user via signup so we have valid credentials.
    const email = uniqueEmail();
    const password = "Passw0rd!";

    await page.goto("/signup");
    await page.getByTestId("signup-email").fill(email);
    await page.getByTestId("signup-password").fill(password);
    await page.getByTestId("signup-confirm").fill(password);
    await page.getByTestId("signup-displayname").fill("E2E Session");
    await page.getByTestId("signup-submit").click();
    await page.waitForURL("**/app");

    // Log out by clearing storage and navigating to /login. We don't need a
    // proper logout UI flow for this test.
    await page.evaluate(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
    });

    await page.goto("/login");
    await expect(page.getByTestId("login-remember")).toBeVisible();
    // Uncheck Remember Me.
    const remember = page.getByTestId("login-remember");
    if (await remember.isChecked()) {
      await remember.uncheck();
    }
    await expect(remember).not.toBeChecked();

    await page.getByTestId("login-email").fill(email);
    await page.getByTestId("login-password").fill(password);
    await page.getByTestId("login-submit").click();
    await page.waitForURL("**/app", { timeout: 10_000 });

    const localAccess = await page.evaluate(() =>
      window.localStorage.getItem("wn:access"),
    );
    const sessionAccess = await page.evaluate(() =>
      window.sessionStorage.getItem("wn:access"),
    );
    const sessionMode = await page.evaluate(() =>
      window.sessionStorage.getItem("wn:mode"),
    );
    expect(sessionAccess).toBeTruthy();
    expect(localAccess).toBeNull();
    expect(sessionMode).toBe("session");
  });

  test("Google sign-in surface renders on /login and /signup", async ({
    page,
  }) => {
    // When NEXT_PUBLIC_GOOGLE_CLIENT_ID is missing we render the fallback
    // disabled button. When it's set we render the GSI widget. Either way,
    // one of the two roots must exist on the page.
    for (const route of ["/login", "/signup"] as const) {
      await page.goto(route);
      const testId = route === "/login" ? "google-signin" : "google-signup";
      const live = page.getByTestId(testId);
      const fallback = page.getByTestId(`${testId}-fallback`);
      const isLive = await live.count();
      const isFallback = await fallback.count();
      expect(isLive + isFallback).toBeGreaterThanOrEqual(1);
    }
  });
});
