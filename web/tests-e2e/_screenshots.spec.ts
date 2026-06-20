import { test } from "@playwright/test";

const uniqueEmail = () =>
  `shot_${Date.now()}_${Math.floor(Math.random() * 1e6)}@example.com`;

test("capture screenshots of key screens", async ({ page }) => {
  const email = uniqueEmail();
  const password = "Passw0rd!";

  // Landing
  await page.goto("/");
  await page.screenshot({ path: "test-results/01-landing.png", fullPage: true });

  // Signup
  await page.goto("/signup");
  await page.screenshot({ path: "test-results/02-signup.png", fullPage: true });
  await page.getByTestId("signup-email").fill(email);
  await page.getByTestId("signup-password").fill(password);
  await page.getByTestId("signup-confirm").fill(password);
  await page.getByTestId("signup-displayname").fill("Shot User");
  await page.getByTestId("signup-submit").click();
  await page.waitForURL("**/app");
  await page.screenshot({ path: "test-results/03-home.png", fullPage: true });

  // Today editor
  await page.getByTestId("today-cta").click();
  await page.waitForURL("**/app/today");
  await page
    .getByTestId("memo-editor")
    .waitFor({ state: "visible" });
  await page
    .getByTestId("memo-editor")
    .fill(
      "# 오늘의 인사이트\n\n- WellNote 첫 메모를 작성합니다.\n- 마크다운 *서식*도 지원합니다.\n- 자동저장 동작 확인.",
    );
  await page.waitForTimeout(1500);
  await page.screenshot({ path: "test-results/04-today.png", fullPage: true });

  // Home after writing — grid should show today's cell
  await page.goto("/app");
  await page.getByTestId("activity-grid").waitFor({ state: "visible" });
  await page.waitForTimeout(500);
  await page.screenshot({
    path: "test-results/03b-home-with-cell.png",
    fullPage: true,
  });

  // Settings
  await page.goto("/app/settings");
  await page.screenshot({ path: "test-results/05-settings.png", fullPage: true });

  // Search
  await page.goto("/app/search");
  await page.screenshot({ path: "test-results/06-search.png", fullPage: true });
});
