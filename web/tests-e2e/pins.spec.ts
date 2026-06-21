import { test, expect } from "@playwright/test";

const uniqueEmail = () =>
  `e2e_pin_${Date.now()}_${Math.floor(Math.random() * 1e6)}@example.com`;

async function signupFresh(page: import("@playwright/test").Page) {
  const email = `e2e_pin_${Date.now()}_${Math.floor(Math.random() * 1e6)}@example.com`;
  const password = "Passw0rd!";
  await page.goto("/signup");
  await page.getByTestId("signup-email").fill(email);
  await page.getByTestId("signup-password").fill(password);
  await page.getByTestId("signup-confirm").fill(password);
  await page.getByTestId("signup-displayname").fill("Pin E2E");
  await page.getByTestId("signup-submit").click();
  await page.waitForURL("**/app", { timeout: 10_000 });
  return { email, password };
}

test.describe("Pin system", () => {
  test("create pin from empty state and see it on corkboard", async ({
    page,
  }) => {
    await signupFresh(page);
    await page.goto("/app/pins");
    await expect(page.getByTestId("pin-empty")).toBeVisible();
    await page.getByTestId("pin-empty-cta").click();
    await page.getByTestId("pin-name-input").fill("영감 메모");
    await page.getByTestId("pin-color-blue").click();
    await page.getByRole("button", { name: "만들기" }).click();
    // Pin card should appear on the corkboard.
    const card = page.locator("[data-testid^='pin-card-']").first();
    await expect(card).toBeVisible({ timeout: 5_000 });
    await expect(card).toContainText("영감 메모");
  });

  test("attach today memo to a pin and see it in pin detail", async ({
    page,
  }) => {
    await signupFresh(page);

    // Write a memo first.
    await page.goto("/app/today");
    const editor = page.getByTestId("memo-editor");
    await expect(editor).toHaveAttribute("data-ready", "true", {
      timeout: 10_000,
    });
    await editor.fill("핀에 꽂아볼 첫 메모 — 분류해보자.");
    await expect(page.getByTestId("save-state")).toHaveAttribute(
      "data-state",
      "saved",
      { timeout: 10_000 },
    );

    // Open the memo actions menu and pick "핀에 꽂기".
    await page.getByTestId("memo-actions-trigger").click();
    await page.getByTestId("memo-actions-pin").click();

    // Picker dialog opens; pins list is empty so create a new one.
    await expect(page.getByTestId("pin-picker")).toBeVisible();
    await page.getByTestId("pin-picker-create").click();
    // Picker closes; the create form opens. Wait for the form input to mount.
    await expect(page.getByTestId("pin-name-input")).toBeVisible();
    await page.getByTestId("pin-name-input").fill("일상");
    await page.getByTestId("pin-color-green").click();

    // Wait for POST /pins and PATCH /memos/:id/pin to finish before navigating.
    const pinCreate = page.waitForResponse(
      (r) => r.url().endsWith("/pins") && r.request().method() === "POST",
    );
    const memoPin = page.waitForResponse(
      (r) => /\/memos\/[^/]+\/pin$/.test(r.url()) && r.request().method() === "PATCH",
    );
    await page.getByRole("button", { name: "만들고 꽂기" }).click();
    await pinCreate;
    await memoPin;

    // After attaching, dialogs close — visit pin list.
    await page.goto("/app/pins");
    const card = page.locator("[data-testid^='pin-card-']").first();
    await expect(card).toBeVisible();
    await expect(card).toContainText("일상");
    await expect(card).toContainText("1개 메모");

    // Drill into detail; memo row should be visible.
    await card.click();
    await expect(page.getByTestId("pin-name")).toContainText("일상");
    await expect(page.getByTestId("pin-memo-list")).toBeVisible();
    const memoRow = page.locator("[data-testid^='pin-memo-']").first();
    await expect(memoRow).toBeVisible();
  });
});
