import { expect, test } from "@playwright/test";

test("home is the default and reads local activity with keyboard-accessible days", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "__TAURI_OS_PLUGIN_INTERNALS__", {
      value: { platform: "macos", os_type: "macos", locale: "en-US" },
    });
  });
  await page.route("**/src/main.tsx", async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      body:
        `import { mockIPC, mockWindows } from "/node_modules/@tauri-apps/api/mocks.js";
mockWindows("main");
let wordsToday = 90;
window.recordUnsavedDictation = async () => {
  wordsToday += 4;
  const { emit } = await import("/node_modules/@tauri-apps/api/event.js");
  await emit("activity-updated");
};
mockIPC((cmd) => {
  if (cmd === "get_app_settings") {
    return { app_language: "en", theme: "light", onboarding_completed: true, show_whats_new_on_update: false };
  }
  if (cmd.includes("permission")) return true;
  if (cmd === "get_secure_input_status") return { sustained: false };
  if (cmd === "get_retired_models" || cmd.startsWith("get_available") || cmd === "get_active_notices") return [];
  if (cmd === "get_activity_summary") return {
    today: "2026-11-21", words_today: wordsToday, words_total: 59025 + wordsToday - 90, transcriptions: wordsToday === 90 ? 432 : 433,
    streak: 3, days: [{ date: "2026-11-21", words: wordsToday }, { date: "2026-11-20", words: 820 }],
  };
}, { shouldMockEvents: true });
` + (await response.text()),
    });
  });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Home", exact: true }),
  ).toBeVisible();
  await expect(page.locator("nav [aria-current=page]")).toHaveText("Home");
  await expect(page.locator(".prism-stat-wordsToday dd")).toHaveText("90");
  await expect(page.locator(".prism-stat-wordsTotal dd")).toHaveText("59,025");
  await expect(page.locator(".prism-stat-transcriptions dd")).toHaveText("432");
  await expect(page.locator(".prism-stat-streak dd")).toHaveText("3 days");
  await expect(page.locator(".prism-stat-timeSaved dd")).toHaveText("13.12 hr");
  await expect(page.getByText("Estimate", { exact: true })).toHaveCount(0);
  const today = page.getByRole("button", { name: /November 21.*90/ });
  const yesterday = page.getByRole("button", { name: /November 20.*820/ });
  await expect(today).toHaveAttribute("data-level", "1");
  await expect(yesterday).toHaveAttribute("data-level", "4");
  await today.focus();
  await today.press("ArrowUp");
  await expect(yesterday).toBeFocused();
  await expect(page.locator(".prism-activity-detail")).toContainText("820");
  await expect(page.getByText("Update Checking Disabled")).toHaveCount(0);
  await page.evaluate(() =>
    (
      window as Window & { recordUnsavedDictation: () => Promise<void> }
    ).recordUnsavedDictation(),
  );
  await expect(page.locator(".prism-stat-wordsToday dd")).toHaveText("94");
  await expect(page.locator(".prism-stat-transcriptions dd")).toHaveText("433");
});
