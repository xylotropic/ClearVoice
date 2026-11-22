import { create } from "zustand";
import { commands } from "@/bindings";
import { useModelStore } from "@/stores/modelStore";

interface ModelPickState {
  target: string | null;
  switching: string | null;
}

export const useModelPickStore = create<ModelPickState>(() => ({
  target: null,
  switching: null,
}));

let revision = 0;
let switchQueue = Promise.resolve(false);

const onDisk = (id: string) =>
  useModelStore.getState().getModelInfo(id)?.is_downloaded === true;

async function waitForDownload(id: string) {
  const store = useModelStore.getState();
  const active = () => {
    const state = useModelStore.getState();
    return state.isModelDownloading(id) || state.isModelVerifying(id);
  };

  if (active()) {
    await new Promise<void>((resolve) => {
      const check = () => {
        if (active()) return;
        unsubscribe();
        resolve();
      };
      const unsubscribe = useModelStore.subscribe(check);
      check();
    });
  } else if (!(await store.downloadModel(id))) {
    return false;
  }

  // Download cancellation can return successfully at the IPC layer. The
  // catalog, refreshed here, is the authority on whether the file is usable.
  await store.loadModels();
  return onDisk(id);
}

/** Download if necessary, then activate only the user's latest choice. */
export async function pickModel(id: string): Promise<boolean> {
  const version = ++revision;
  useModelPickStore.setState({ target: id });

  try {
    if (!onDisk(id) && !(await waitForDownload(id))) return false;
    if (version !== revision) return false;

    const switchModel = async () => {
      while (version === revision) {
        const canSwitch = await commands.canSwitchModel();
        if (version !== revision) return false;
        if (canSwitch) {
          const store = useModelStore.getState();
          if (store.currentModel === id) return true;
          useModelPickStore.setState({ switching: id });
          if (await store.selectModel(id)) return version === revision;
          // A recording may have started between the status check and the
          // command. Try again after it finishes. A real load error is final.
          if (await commands.canSwitchModel()) return false;
          useModelPickStore.setState({ switching: null });
        }
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
      return false;
    };

    switchQueue = switchQueue.then(switchModel).catch(() => false);
    return await switchQueue;
  } finally {
    const state = useModelPickStore.getState();
    if (version === revision) useModelPickStore.setState({ target: null });
    if (
      state.switching === id &&
      (version === revision || state.target !== id)
    ) {
      useModelPickStore.setState({ switching: null });
    }
  }
}

export function cancelModelPick(id: string) {
  if (useModelPickStore.getState().target === id) {
    revision++;
    useModelPickStore.setState({ target: null });
  }
  void useModelStore.getState().cancelDownload(id);
}
