import { test, expect } from "@playwright/test";

const uniqueEmail = () =>
  `e2e_streak_${Date.now()}_${Math.floor(Math.random() * 1e6)}@example.com`;

test.describe("Streak UI", () => {
  test("new signup shows 🔥 0 badge and dialog with 3-day next milestone", async ({
    page,
  }) => {
    const email = uniqueEmail();
    const password = "Passw0rd!";

    await page.goto("/signup");
    await page.getByTestId("signup-email").fill(email);
    await page.getByTestId("signup-password").fill(password);
    await page.getByTestId("signup-confirm").fill(password);
    await page.getByTestId("signup-displayname").fill("Streak E2E");
    await page.getByTestId("signup-submit").click();

    await page.waitForURL("**/app", { timeout: 10_000 });

    const badge = page.getByTestId("streak-badge");
    await expect(badge).toBeVisible();
    await expect(badge).toContainText("0");
    await expect(badge).toHaveAttribute("data-current", "0");

    await badge.click();
    const dialog = page.getByTestId("streak-dialog");
    await expect(dialog).toBeVisible();
    await expect(page.getByTestId("streak-dialog-current")).toContainText(
      "0일",
    );
    // First milestone is 3 days.
    await expect(dialog).toContainText("3일");
  });

  test("milestone celebration appears when current matches a milestone and beats lastSeen", async ({
    page,
  }) => {
    const email = uniqueEmail();
    const password = "Passw0rd!";

    await page.goto("/signup");
    await page.getByTestId("signup-email").fill(email);
    await page.getByTestId("signup-password").fill(password);
    await page.getByTestId("signup-confirm").fill(password);
    await page.getByTestId("signup-displayname").fill("Milestone E2E");
    await page.getByTestId("signup-submit").click();
    await page.waitForURL("**/app", { timeout: 10_000 });

    // Simulate: backend says current=3 (milestone), and the client has never
    // seen a celebration yet. Set up the route before navigating so the
    // first fetch is intercepted, and clear lastSeenMilestone via an init
    // script that runs before any page script.
    await page.addInitScript(() => {
      try {
        window.localStorage.removeItem("wn:lastSeenMilestone");
      } catch {
        /* ignore */
      }
    });
    await page.route("**/streak/status*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          current: 3,
          longest: 3,
          freezes: 0,
          lastDay: new Date().toISOString().slice(0, 10),
          nextMilestone: 7,
          daysToNextMilestone: 4,
        }),
      });
    });
    await page.goto("/app");

    const dlg = page.getByTestId("milestone-dialog");
    await expect(dlg).toBeVisible({ timeout: 10_000 });
    await expect(dlg).toContainText("3일");
    await expect(dlg).toContainText("+20");
    await expect(dlg).toContainText("다음 목표는 7일");

    // Persistence: re-visiting /app should NOT show the dialog again.
    await page.getByTestId("milestone-ok").click();
    await expect(dlg).not.toBeVisible();
    await page.reload();
    await expect(page.getByTestId("milestone-dialog")).not.toBeVisible();
  });
});
