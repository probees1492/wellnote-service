import { test } from "@playwright/test";

// Visual capture for streak UI in light + dark modes. Requires the backend
// to be running so signup/login work. Saves PNGs under test-results/streak/.
test.describe("streak design snapshots", () => {
  for (const mode of ["light", "dark"] as const) {
    test(`streak badge + dialog + grid highlight — ${mode}`, async ({
      page,
    }) => {
      await page.addInitScript((m) => {
        try {
          window.localStorage.setItem("theme", m);
        } catch {
          /* ignore */
        }
      }, mode);

      const email = `e2e_shot_${Date.now()}_${Math.floor(
        Math.random() * 1e6,
      )}@example.com`;
      const password = "Passw0rd!";

      await page.goto("/signup");
      await page.evaluate((m) => {
        document.documentElement.classList.toggle("dark", m === "dark");
      }, mode);
      await page.getByTestId("signup-email").fill(email);
      await page.getByTestId("signup-password").fill(password);
      await page.getByTestId("signup-confirm").fill(password);
      await page.getByTestId("signup-displayname").fill("Streak Shot");
      await page.getByTestId("signup-submit").click();
      await page.waitForURL("**/app");
      await page.evaluate((m) => {
        document.documentElement.classList.toggle("dark", m === "dark");
      }, mode);

      // Mock streak status: pretend user is mid-progress (5 days, last day
      // today) so the grid highlight renders and the dialog shows a partial
      // progress bar to the next 7-day milestone.
      await page.route("**/streak/status*", async (route) => {
        const today = new Date().toISOString().slice(0, 10);
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            current: 5,
            longest: 8,
            freezes: 1,
            lastDay: today,
            nextMilestone: 7,
            daysToNextMilestone: 2,
          }),
        });
      });
      // Ensure no celebration triggers — we want a clean home screenshot.
      await page.evaluate(() => {
        try {
          window.localStorage.setItem("wn:lastSeenMilestone", "9999");
        } catch {
          /* ignore */
        }
      });
      await page.reload();
      await page.waitForSelector('[data-testid="streak-badge"]');
      await page.screenshot({
        path: `test-results/streak/${mode}-01-home.png`,
        fullPage: true,
      });

      await page.getByTestId("streak-badge").click();
      await page.waitForSelector('[data-testid="streak-dialog"]');
      await page.screenshot({
        path: `test-results/streak/${mode}-02-dialog.png`,
        fullPage: false,
      });
    });
  }
});
