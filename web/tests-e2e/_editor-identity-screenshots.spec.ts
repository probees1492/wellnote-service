import { test } from "@playwright/test";

const uniqueEmail = () =>
  `ishot_${Date.now()}_${Math.floor(Math.random() * 1e6)}@example.com`;

test.describe("editor identity — screenshots", () => {
  for (const mode of ["light", "dark"] as const) {
    test(`today page — ${mode}`, async ({ page }) => {
      await page.addInitScript((m) => {
        try {
          window.localStorage.setItem("theme", m);
        } catch {
          /* ignore */
        }
      }, mode);

      const email = uniqueEmail();
      const password = "Passw0rd!";
      await page.goto("/signup");
      await page.getByTestId("signup-email").fill(email);
      await page.getByTestId("signup-password").fill(password);
      await page.getByTestId("signup-confirm").fill(password);
      await page.getByTestId("signup-displayname").fill("Shot User");
      await page.getByTestId("signup-submit").click();
      await page.waitForURL("**/app", { timeout: 15_000 });

      await page.evaluate((m) => {
        document.documentElement.classList.toggle("dark", m === "dark");
      }, mode);

      await page.getByTestId("today-cta").click();
      await page.waitForURL("**/app/today");
      await page.getByTestId("memo-editor").waitFor({ state: "visible" });
      await page
        .getByTestId("memo-editor")
        .fill(
          "오늘 아침은 오랜만에 비가 잦아들었습니다. 책상 앞에 앉아 천천히 호흡을 가다듬고, 한 칸씩 정성껏 적어 봅니다.",
        );
      // Re-apply theme just in case next-themes restored it.
      await page.evaluate((m) => {
        document.documentElement.classList.toggle("dark", m === "dark");
      }, mode);
      await page.waitForTimeout(800);
      await page.screenshot({
        path: `test-results/editor-identity/${mode}.png`,
        fullPage: true,
      });
    });
  }
});
