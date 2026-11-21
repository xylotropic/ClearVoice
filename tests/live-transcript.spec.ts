import { expect, test } from "@playwright/test";

test("streams revisions without replaying confirmed words", async ({
  page,
}) => {
  await page.goto("/src/overlay/index.html");
  const emit = (name: string, payload?: unknown) =>
    page.evaluate(
      async ({ name, payload }) => {
        const eventModule = "/node_modules/@tauri-apps/api/event.js";
        const { emit } = await import(eventModule);
        await emit(name, payload);
      },
      { name, payload },
    );

  await expect(async () => {
    await emit("show-overlay", "streaming");
    await expect(page.locator(".scard")).toBeVisible({ timeout: 500 });
  }).toPass();
  await emit("stream-text-event", {
    committed: "",
    tentative: "Open the right file",
  });

  const open = page.getByText("Open", { exact: true });
  await expect(open).toHaveClass(/tentative/);
  const originalOpen = await open.elementHandle();

  await emit("stream-text-event", {
    committed: "Open the",
    tentative: "write file",
  });
  await expect(open).toHaveClass(/committed/);
  expect(await originalOpen?.evaluate((word) => word.isConnected)).toBe(true);
  const revisedWord = page.getByText("write", { exact: true });
  await expect(revisedWord).toHaveCSS("animation-name", "transcript-arrive");
  await expect(page.locator(".stext-cap p")).toHaveText("Open the write file");

  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(revisedWord).toHaveCSS("animation-name", "none");
  await emit("hide-overlay");
  await emit("show-overlay", "streaming");
  await expect(page.getByText("write", { exact: true })).toHaveCount(0);
});

test.beforeEach(async ({ page }) => {
  await page.route("**/src/overlay/main.tsx", async (route) => {
    const response = await route.fetch();
    const body = await response.text();
    await route.fulfill({
      response,
      body:
        `import { mockIPC } from "/node_modules/@tauri-apps/api/mocks.js";
mockIPC((cmd) => cmd === "get_app_settings" ? {
  app_language: "en",
  overlay_position: "bottom",
  theme: "light"
} : undefined, { shouldMockEvents: true });
` + body,
    });
  });
});
