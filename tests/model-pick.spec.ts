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
