import { expect, test, type Page } from "@playwright/test";

test("streams revisions without replaying confirmed words", async ({
  page,
}) => {
  await page.goto("/src/overlay/index.html");

  await expect(async () => {
    await emit(page, "show-overlay", "streaming");
    await expect(page.locator(".scard")).toBeVisible({ timeout: 500 });
  }).toPass();
  await emit(page, "stream-text-event", {
    committed: "",
    tentative: "Open the right file",
  });

  const open = page.locator(".transcript-word").filter({ hasText: /^Open$/ });
  await expect(open).toHaveClass(/tentative/);
  await expect(page.getByText("the", { exact: true })).toHaveCSS(
    "animation-delay",
    "0.032s",
  );
  const originalOpen = await open.elementHandle();

  await emit(page, "stream-text-event", {
    committed: "Open the",
    tentative: "write file",
  });
  await expect(open).toHaveClass(/committed/);
  expect(await originalOpen?.evaluate((word) => word.isConnected)).toBe(true);
  const revisedWord = page.getByText("write", { exact: true });
  await expect(page.locator(".ov-stage")).toHaveAttribute(
    "data-animation",
    "generate",
  );
  await expect(revisedWord).toHaveCSS("animation-name", "transcript-generate");
  await expect(revisedWord).toHaveCSS("animation-delay", "0s");
  await expect(page.locator(".stext-cap p")).toHaveText("Open the write file");

  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(revisedWord).toHaveCSS("animation-name", "none");
  await emit(page, "hide-overlay");
  await emit(page, "show-overlay", "streaming");
  await expect(page.getByText("write", { exact: true })).toHaveCount(0);
});

test("the virtual notch stays attached as the live transcript opens", async ({
  browser,
}) => {
  const page = await browser.newPage({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/131.0.0.0",
    viewport: { width: 344, height: 120 },
    reducedMotion: "reduce",
  });
  try {
    await mockOverlay(page, "top");
    await page.goto("http://localhost:1420/src/overlay/index.html");
    await expect(async () => {
      await emit(page, "overlay-display-layout", {
        position: "top",
        cameraWidth: 160,
        cameraHeight: 28,
      });
      await emit(page, "show-overlay", "streaming");
      await expect(page.locator(".ov-stage.attached .scard")).toBeVisible({
        timeout: 500,
      });
    }).toPass();
    const card = page.locator(".scard");
    const resting = await card.boundingBox();
    expect(resting?.y).toBe(0);
    expect(resting?.width).toBe(266);
    const meter = await page.locator(".swave").boundingBox();
    expect(meter?.x).toBeGreaterThanOrEqual(344 / 2 + 80);
    const mark = page.locator(".smark");
    await expect(mark).toHaveAttribute("src", /prism-mark/);
    const markBounds = await mark.boundingBox();
    expect((markBounds?.x ?? 0) + (markBounds?.width ?? 0)).toBeLessThanOrEqual(
      344 / 2 - 80,
    );
    expect(markBounds?.y).toBeLessThan(28);
    await expect(mark).toHaveCSS("filter", "none");
    await expect(card).toHaveCSS("background-color", "rgb(0, 0, 0)");
    await page.mouse.move(2, 115);
    await expect(page.locator(".sx")).toHaveCSS("opacity", "0");
    await card.hover();
    await expect(page.locator(".sx")).toHaveCSS("opacity", "1");
    await emit(page, "recording-ready");
    await emit(page, "mic-level", Array(16).fill(0.65));
    await expect(page.locator(".sbase.listening")).toHaveAttribute(
      "data-speaking",
      "true",
    );
    await expect(mark).toHaveCSS("filter", "none");
    expect(
      (await page.locator(".swave i").nth(3).boundingBox())?.height,
    ).toBeGreaterThan(20);
    await emit(page, "stream-text-event", {
      committed: "Open the right file",
      tentative: "",
    });
    await expect(card).toHaveClass(/open/);
    const expanded = await card.boundingBox();
    expect(expanded?.y).toBe(0);
    expect(expanded?.width).toBeGreaterThan(resting?.width ?? 0);
    expect(expanded?.width).toBeLessThan(344);
    expect((expanded?.y ?? 0) + (expanded?.height ?? 0)).toBeLessThanOrEqual(
      120,
    );
    await expect(page.locator(".stext-cap p")).toHaveText(
      "Open the right file",
    );
    const textBounds = await page.locator(".stext-cap").boundingBox();
    expect(textBounds?.y).toBeGreaterThanOrEqual(28);
    await emit(page, "paste-confirmed");
    await expect(card).toHaveCSS("border-bottom-color", "rgb(71, 166, 255)");

    await emit(page, "overlay-display-layout", {
      position: "top",
      cameraWidth: 210,
      cameraHeight: 32,
    });
    await expect(page.locator(".ov-stage")).toHaveClass(/below-camera/);
    expect((await mark.boundingBox())?.y).toBeGreaterThanOrEqual(32);
    expect(
      (await page.locator(".swave").boundingBox())?.y,
    ).toBeGreaterThanOrEqual(32);
  } finally {
    await page.close();
  }
});

test("Escape feedback offers Undo for a recoverable take", async ({ page }) => {
  await page.goto("/src/overlay/index.html");
  await expect(async () => {
    await emit(page, "show-overlay", "recording");
    await expect(page.locator(".scard")).toBeVisible({ timeout: 500 });
  }).toPass();
  await emit(page, "overlay-cancelled", { id: 7, canUndo: true });
  await emit(page, "show-overlay", "cancelled");
  await expect(page.getByRole("status")).toHaveText("Dictation canceled");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as Window & { cancellationChoice?: unknown })
            .cancellationChoice,
      ),
    )
    .toEqual({ id: 7, undo: true });

  await emit(page, "show-overlay", "transcribing");
  await expect(
    page.getByRole("button", { name: "Undo", exact: true }),
  ).toHaveCount(0);
  await emit(page, "overlay-cancelled", { id: 8, canUndo: false });
  await emit(page, "show-overlay", "cancelled");
  await expect(page.getByRole("status")).toHaveText("Dictation canceled");
  await expect(
    page.getByRole("button", { name: "Undo", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as Window & { cancellationChoice?: unknown })
            .cancellationChoice,
      ),
    )
    .toEqual({ id: 8, undo: false });
});

for (const [option, target, keyframe] of [
  ["encrypted", ".transcript-glyphs", "transcript-decode"],
  ["sweep", ".transcript-word", "transcript-sweep"],
  ["typewriter", ".transcript-glyphs", "transcript-type"],
  ["off", ".transcript-glyphs", "none"],
] as const) {
  test(`renders live text with the saved ${option} animation`, async ({
    page,
  }) => {
    await mockOverlay(page, "bottom", option);
    await page.goto("/src/overlay/index.html");
    await expect(async () => {
      await emit(page, "show-overlay", "streaming");
      await expect(page.locator(".ov-stage")).toHaveAttribute(
        "data-animation",
        option,
        { timeout: 500 },
      );
    }).toPass();
    await emit(page, "stream-text-event", {
      committed: "Ready",
      tentative: "",
    });
    await expect(page.locator(target)).toHaveCSS("animation-name", keyframe);
    if (option === "encrypted") {
      await expect(page.locator(".transcript-cipher")).toHaveAttribute(
        "aria-hidden",
        "true",
      );
    } else {
      await expect(page.locator(".transcript-cipher")).toHaveCount(0);
    }
  });
}

test.beforeEach(({ page }) => mockOverlay(page, "bottom"));

function emit(page: Page, name: string, payload?: unknown) {
  return page.evaluate(
    async ({ name, payload }) => {
      const eventModule = "/node_modules/@tauri-apps/api/event.js";
      const { emit } = await import(eventModule);
      await emit(name, payload);
    },
    { name, payload },
  );
}

async function mockOverlay(
  page: Page,
  position: "top" | "bottom",
  animation?: "encrypted" | "sweep" | "typewriter" | "off",
) {
  await page.route("**/src/overlay/main.tsx", async (route) => {
    const response = await route.fetch();
    const body = await response.text();
    await route.fulfill({
      response,
      body:
        `import { mockIPC } from "/node_modules/@tauri-apps/api/mocks.js";
mockIPC((cmd, args) => {
  if (cmd === "resolve_cancellation") {
    window.cancellationChoice = args;
    return;
  }
  if (cmd === "get_app_settings") return {
  app_language: "en",
  overlay_position: "${position}",
  transcript_animation: ${JSON.stringify(animation)},
  theme: "light"
  };
}, { shouldMockEvents: true });
` + body,
    });
  });
}
