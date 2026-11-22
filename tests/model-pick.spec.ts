import { expect, test } from "@playwright/test";

test("the newest downloaded model waits for dictation and becomes active", async ({
  page,
}) => {
  await page.route("**/model-pick-fixture", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<!doctype html><title>Model pick fixture</title>",
    }),
  );
  await page.goto("/model-pick-fixture");

  const result = await page.evaluate(async () => {
    const mockModule = "/node_modules/@tauri-apps/api/mocks.js";
    const modelPickModule = "/src/stores/modelPickStore.ts";
    const modelStoreModule = "/src/stores/modelStore.ts";
    const { mockIPC } = await import(mockModule);
    const { pickModel, useModelPickStore } = await import(modelPickModule);
    const { useModelStore } = await import(modelStoreModule);
    const downloaded = new Set<string>();
    const complete = new Map<string, () => void>();
    const selected: string[] = [];
    let dictating = true;
    let canSwitchChecks = 0;
    const inventory = () =>
      ["first", "second"].map((id) => ({
        id,
        is_downloaded: downloaded.has(id),
        is_downloading: complete.has(id),
      }));
    mockIPC((command: string, args: { modelId: string }) => {
      switch (command) {
        case "download_model":
          return new Promise<void>((resolve) => {
            complete.set(args.modelId, () => {
              downloaded.add(args.modelId);
              complete.delete(args.modelId);
              resolve();
            });
          });
        case "get_available_models":
          return inventory();
        case "can_switch_model":
          canSwitchChecks++;
          return !dictating;
        case "set_active_model":
          selected.push(args.modelId);
      }
    });
    useModelStore.getState().setModels(inventory());
    const first = pickModel("first");
    const second = pickModel("second");
    complete.get("second")?.();

    for (let i = 0; canSwitchChecks < 1 && i < 20; i++) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    const duringDictation = [...selected];
    complete.get("first")?.();
    const stalePickActivated = await first;
    dictating = false;

    return {
      duringDictation,
      waitedForDictation: canSwitchChecks > 0,
      stalePickActivated,
      currentPickActivated: await second,
      selected,
      current: useModelStore.getState().currentModel,
      target: useModelPickStore.getState().target,
    };
  });

  expect(result).toEqual({
    duringDictation: [],
    waitedForDictation: true,
    stalePickActivated: false,
    currentPickActivated: true,
    selected: ["second"],
    current: "second",
    target: null,
  });
});

test("repeated clicks at the same point keep the selected model", async ({
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
const models = [
  ["nemotron", "Nemotron Streaming 3.5"],
  ["parakeet", "Parakeet Unified English 0.6B"],
  ["parakeet-local", "Parakeet TDT 0.6B v2"],
].map(([id, name]) => ({
  id, name, filename: id + ".gguf", source: "Custom", description: "",
  size_mb: 700, supported_languages: ["en"], supports_streaming: id !== "parakeet-local",
  is_downloaded: id !== "parakeet-local",
  ...(id === "parakeet-local" ? { source: { HuggingFace: { repo_id: "handy-computer/parakeet-tdt-0.6b-v2-gguf" } } } : {}),
}));
let current = "nemotron";
mockIPC((cmd, args) => {
  if (cmd === "get_app_settings") return { app_language: "en", theme: "light", onboarding_completed: true, spoken_languages: ["en"] };
  if (cmd.includes("permission")) return true;
  if (cmd === "get_secure_input_status") return { sustained: false };
  if (cmd === "get_available_models") return models;
  if (cmd === "get_current_model") return current;
  if (cmd === "can_switch_model") return true;
  if (cmd === "set_active_model") { current = args.modelId; return; }
  if (cmd === "download_model") return new Promise(() => {});
  if (cmd === "get_retired_models" || cmd.startsWith("get_available") || cmd === "get_active_notices") return [];
}, { shouldMockEvents: true });
` + (await response.text()),
    });
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Models", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Live preview", exact: true }),
  ).toBeVisible();
  const parakeet = page.getByRole("radio", {
    name: /Parakeet Unified English/,
  });
  const point = await parakeet.boundingBox();
  if (!point) throw new Error("Parakeet row was not visible");
  const x = point.x + 100;
  const y = point.y + point.height / 2;
  await page.mouse.click(x, y);
  await expect(parakeet).toBeChecked();
  await page.mouse.click(x, y);
  await expect(parakeet).toBeChecked();
  await expect(
    page.getByRole("radio", { name: /Nemotron Streaming/ }),
  ).not.toBeChecked();
  await expect(
    page.getByText("For your languages", { exact: true }),
  ).toBeVisible();
  const remote = page.getByRole("radio", { name: /Parakeet TDT 0.6B v2/ });
  await expect(remote.locator('img[title="NVIDIA"]')).toBeVisible();
  await remote.click();
  await expect(remote.getByRole("status")).toHaveText(
    "Downloading Parakeet TDT 0.6B v2",
  );
  await expect(
    remote.getByRole("button", { name: /Stop downloading/ }),
  ).toBeVisible();
});
