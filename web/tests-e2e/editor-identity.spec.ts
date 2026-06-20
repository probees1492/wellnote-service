import { test, expect } from "@playwright/test";

const uniqueEmail = () =>
  `ident_${Date.now()}_${Math.floor(Math.random() * 1e6)}@example.com`;

async function signUpAndOpenEditor(
  page: import("@playwright/test").Page,
  displayName = "Editor Identity",
) {
  const email = uniqueEmail();
  const password = "Passw0rd!";
  await page.goto("/signup");
  await page.getByTestId("signup-email").fill(email);
  await page.getByTestId("signup-password").fill(password);
  await page.getByTestId("signup-confirm").fill(password);
  await page.getByTestId("signup-displayname").fill(displayName);
  await page.getByTestId("signup-submit").click();
  await page.waitForURL("**/app", { timeout: 10_000 });
  await page.getByTestId("today-cta").click();
  await page.waitForURL("**/app/today");
  const editor = page.getByTestId("memo-editor");
  await expect(editor).toBeVisible();
  await expect(editor).toHaveAttribute("data-ready", "true", {
    timeout: 10_000,
  });
}

test.describe("ManuscriptEditor identity", () => {
  test("editor mounts with manuscript paper + countdown + caret colour", async ({
    page,
  }) => {
    await signUpAndOpenEditor(page);

    // Paper container has the manuscript grid class.
    const paperWrap = page.locator(".wn-paper").first();
    await expect(paperWrap).toBeVisible();
    await expect(paperWrap).toHaveAttribute("data-grid-style", "manuscript");

    // Countdown text is visible by default.
    const countdown = page.getByTestId("seal-countdown");
    await expect(countdown).toBeVisible();
    await expect(countdown).toContainText("자정까지");

    // Caret colour should be the primary token.
    const caretColor = await page
      .getByTestId("memo-editor")
      .evaluate((el) => window.getComputedStyle(el).caretColor);
    expect(caretColor).toBeTruthy();
    expect(caretColor).not.toBe("");
  });

  test("settings toggle changes grid-style data attribute on editor", async ({
    page,
  }) => {
    await signUpAndOpenEditor(page);

    await page.goto("/app/settings");
    await expect(page.getByTestId("editor-settings")).toBeVisible();

    // Switch to "lines".
    await page.getByTestId("grid-style-lines").click();

    await page.goto("/app/today");
    const paperWrap = page.locator(".wn-paper").first();
    await expect(paperWrap).toHaveAttribute("data-grid-style", "lines");

    // Switch to dots.
    await page.goto("/app/settings");
    await page.getByTestId("grid-style-dots").click();
    await page.goto("/app/today");
    await expect(page.locator(".wn-paper").first()).toHaveAttribute(
      "data-grid-style",
      "dots",
    );

    // Turn off seal countdown.
    await page.goto("/app/settings");
    await page.getByTestId("pref-seal").click();
    await page.goto("/app/today");
    await expect(page.getByTestId("seal-countdown")).toHaveCount(0);
  });
});
