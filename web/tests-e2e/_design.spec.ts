import { test } from "@playwright/test";

// Capture light + dark screenshots of public pages — does NOT require the
// backend API to be running.
test.describe("design snapshots", () => {
  for (const mode of ["light", "dark"] as const) {
    test(`landing/login/signup — ${mode}`, async ({ page }) => {
      // Pre-set theme via localStorage before navigating.
      await page.addInitScript((m) => {
        try {
          window.localStorage.setItem("theme", m);
        } catch {
          /* ignore */
        }
      }, mode);

      await page.goto("/");
      // next-themes reads from localStorage; ensure class is applied.
      await page.evaluate((m) => {
        document.documentElement.classList.toggle("dark", m === "dark");
      }, mode);
      await page.screenshot({
        path: `test-results/design/${mode}-01-landing.png`,
        fullPage: true,
      });

      await page.goto("/login");
      await page.evaluate((m) => {
        document.documentElement.classList.toggle("dark", m === "dark");
      }, mode);
      await page.screenshot({
        path: `test-results/design/${mode}-02-login.png`,
        fullPage: true,
      });

      await page.goto("/signup");
      await page.evaluate((m) => {
        document.documentElement.classList.toggle("dark", m === "dark");
      }, mode);
      await page.screenshot({
        path: `test-results/design/${mode}-03-signup.png`,
        fullPage: true,
      });
    });
  }
});
