import { expect, test, type Page } from "@playwright/test";

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

test("the virtual notch stays attached as the live transcript opens", async ({
  browser,
}) => {
  const page = await browser.newPage({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/131.0.0.0",
    viewport: { width: 400, height: 120 },
    reducedMotion: "reduce",
  });
  try {
    await mockOverlay(page, "top");
    await page.goto("http://localhost:1420/src/overlay/index.html");
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
      await expect(page.locator(".ov-stage.docked .scard")).toBeVisible({
        timeout: 500,
      });
    }).toPass();
    const card = page.locator(".scard");
    const resting = await card.boundingBox();
    expect(resting?.y).toBe(0);
    const meter = await page.locator(".swave").boundingBox();
    expect(meter?.x).toBeGreaterThan(200);
    await expect(card).toHaveCSS("background-color", "rgb(0, 0, 0)");
    await page.mouse.move(2, 115);
    await expect(page.locator(".sx")).toHaveCSS("opacity", "0");
    await card.hover();
    await expect(page.locator(".sx")).toHaveCSS("opacity", "1");
    await emit("recording-ready");
    await emit("mic-level", Array(16).fill(0.65));
    await expect(page.locator(".sbase.listening")).toHaveAttribute(
      "data-speaking",
      "true",
    );
    expect(
      (await page.locator(".swave i").nth(6).boundingBox())?.height,
    ).toBeGreaterThan(20);
    await emit("stream-text-event", {
      committed: "Open the right file",
      tentative: "",
    });
    await expect(card).toHaveClass(/open/);
    const expanded = await card.boundingBox();
    expect(expanded?.y).toBe(0);
    expect(expanded?.width).toBeGreaterThan(resting?.width ?? 0);
    await expect(page.locator(".stext-cap p")).toHaveText(
      "Open the right file",
    );
    await emit("paste-confirmed");
    await expect(card).toHaveCSS("border-bottom-color", "rgb(71, 166, 255)");
  } finally {
    await page.close();
  }
});

test.beforeEach(({ page }) => mockOverlay(page, "bottom"));

async function mockOverlay(page: Page, position: "top" | "bottom") {
  await page.route("**/src/overlay/main.tsx", async (route) => {
    const response = await route.fetch();
    const body = await response.text();
    await route.fulfill({
      response,
      body:
        `import { mockIPC } from "/node_modules/@tauri-apps/api/mocks.js";
mockIPC((cmd) => cmd === "get_app_settings" ? {
  app_language: "en",
  overlay_position: "${position}",
  theme: "light"
} : undefined, { shouldMockEvents: true });
` + body,
    });
  });
}
