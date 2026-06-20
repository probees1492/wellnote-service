import { test } from "@playwright/test";

const uniqueEmail = () =>
  `shot_rm_${Date.now()}_${Math.floor(Math.random() * 1e6)}@example.com`;

// Captures storage-mode evidence after a fresh signup in both modes. Useful
// for the QA report. Skipped from CI by default — flip ENABLE_RM_SHOTS=1 to
// produce the images.
test("capture remember-me storage evidence", async ({ page }) => {
  // Persistent path
  const emailA = uniqueEmail();
  await page.goto("/signup");
  await page.getByTestId("signup-email").fill(emailA);
  await page.getByTestId("signup-password").fill("Passw0rd!");
  await page.getByTestId("signup-confirm").fill("Passw0rd!");
  await page.getByTestId("signup-displayname").fill("RM Persistent");
  // remember already true by default
  await page.getByTestId("signup-submit").click();
  await page.waitForURL("**/app");
  const persistent = await page.evaluate(() => ({
    local: Object.fromEntries(
      ["wn:access", "wn:refresh", "wn:user", "wn:mode"].map((k) => [
        k,
        window.localStorage.getItem(k) ? "<set>" : null,
      ]),
    ),
    session: Object.fromEntries(
      ["wn:access", "wn:refresh", "wn:user", "wn:mode"].map((k) => [
        k,
        window.sessionStorage.getItem(k) ? "<set>" : null,
      ]),
    ),
  }));
  await page.screenshot({
    path: "test-results/07-remember-persistent.png",
    fullPage: true,
  });
  console.log("[persistent storage]", JSON.stringify(persistent));

  // Session path
  await page.evaluate(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
  const emailB = uniqueEmail();
  await page.goto("/signup");
  // toggle off remember
  await page.getByTestId("signup-remember").uncheck();
  await page.getByTestId("signup-email").fill(emailB);
  await page.getByTestId("signup-password").fill("Passw0rd!");
  await page.getByTestId("signup-confirm").fill("Passw0rd!");
  await page.getByTestId("signup-displayname").fill("RM Session");
  await page.getByTestId("signup-submit").click();
  await page.waitForURL("**/app");
  const sessionState = await page.evaluate(() => ({
    local: Object.fromEntries(
      ["wn:access", "wn:refresh", "wn:user", "wn:mode"].map((k) => [
        k,
        window.localStorage.getItem(k) ? "<set>" : null,
      ]),
    ),
    session: Object.fromEntries(
      ["wn:access", "wn:refresh", "wn:user", "wn:mode"].map((k) => [
        k,
        window.sessionStorage.getItem(k) ? "<set>" : null,
      ]),
    ),
  }));
  await page.screenshot({
    path: "test-results/08-remember-session.png",
    fullPage: true,
  });
  console.log("[session storage]", JSON.stringify(sessionState));
});
