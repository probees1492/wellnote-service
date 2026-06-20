import { test, expect } from "@playwright/test";

const uniqueEmail = () =>
  `e2e_${Date.now()}_${Math.floor(Math.random() * 1e6)}@example.com`;

test.describe("WellNote E2E", () => {
  test("signup -> redirect to /app -> write memo -> appears in activity grid", async ({
    page,
  }) => {
    page.on("console", (msg) => console.log(`[console.${msg.type()}]`, msg.text()));
    page.on("pageerror", (err) => console.log("[pageerror]", err.message));
    page.on("requestfailed", (req) =>
      console.log("[requestfailed]", req.url(), req.failure()?.errorText),
    );
    page.on("response", async (res) => {
      const url = res.url();
      if (url.includes("/memos") || url.includes("/auth/signup")) {
        console.log(`[net] ${res.status()} ${res.request().method()} ${url}`);
      }
    });

    const email = uniqueEmail();
    const password = "Passw0rd!";

    await page.goto("/signup");
    await page.getByTestId("signup-email").fill(email);
    await page.getByTestId("signup-password").fill(password);
    await page.getByTestId("signup-confirm").fill(password);
    await page.getByTestId("signup-displayname").fill("E2E User");
    await page.getByTestId("signup-submit").click();

    // After signup we should be at /app
    await page.waitForURL("**/app", { timeout: 10_000 });
    await expect(page.getByTestId("credit-balance")).toBeVisible();
    // Initial signup grants +100
    await expect(page.getByTestId("credit-balance")).toContainText("100");

    // Activity grid renders
    await expect(page.getByTestId("activity-grid")).toBeVisible();
    await expect(page.getByTestId("grid-cell-today")).toBeVisible();

    // Go to today
    await page.getByTestId("today-cta").click();
    await page.waitForURL("**/app/today");

    const editor = page.getByTestId("memo-editor");
    await expect(editor).toBeVisible();
    await expect(editor).toHaveAttribute("data-ready", "true", {
      timeout: 10_000,
    });
    const sample =
      "오늘은 WellNote 첫 메모를 작성합니다. 마크다운으로 기록해요.";
    await editor.fill(sample);
    // Wait for save (debounce 1s + RTT)
    await expect(page.getByTestId("save-state")).toHaveAttribute(
      "data-state",
      "saved",
      { timeout: 10_000 },
    );
    await expect(page.getByTestId("char-count")).toContainText(
      `${sample.length}자`,
    );

    // Back to home; today cell should reflect non-zero level
    await page.goto("/app");
    await expect(page.getByTestId("activity-grid")).toBeVisible();
    const todayCell = page.getByTestId("grid-cell-today");
    await expect(todayCell).toBeVisible();
    const level = await todayCell.getAttribute("data-level");
    expect(Number(level)).toBeGreaterThanOrEqual(1);
  });

  test("login with wrong credentials shows error", async ({ page }) => {
    await page.goto("/login");
    await page.getByTestId("login-email").fill("nobody@example.com");
    await page.getByTestId("login-password").fill("wrongpass1!");
    await page.getByTestId("login-submit").click();
    await expect(page.getByTestId("login-error")).toBeVisible({
      timeout: 5_000,
    });
  });

  test("credit balance shows on settings page after signup", async ({
    page,
  }) => {
    const email = uniqueEmail();
    const password = "Passw0rd!";

    await page.goto("/signup");
    await page.getByTestId("signup-email").fill(email);
    await page.getByTestId("signup-password").fill(password);
    await page.getByTestId("signup-confirm").fill(password);
    await page.getByTestId("signup-displayname").fill("E2E User");
    await page.getByTestId("signup-submit").click();
    await page.waitForURL("**/app");

    await page.goto("/app/settings");
    await expect(page.getByTestId("settings-balance")).toContainText("100");
  });
});
