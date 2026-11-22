/** Models page data: the app's model list joined to the catalog by repo. */
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useModelStore } from "@/stores/modelStore";
import { useModelPickStore } from "@/stores/modelPickStore";
import { useSettings } from "@/hooks/useSettings";
import { useModelCatalog } from "@/hooks/useModelCatalog";
import { averageError, type Grading } from "@/lib/models/grading";
import { downloadStateOf } from "@/lib/models/downloadState";
import type { TableModel } from "@/components/shared/modelTable/context";
import {
  isLegacyModel,
  toTableModel,
} from "@/components/shared/modelTable/tableModel";
import { suggestedLanguages } from "@/lib/utils/languageSuggestions";

/** A model on the page: the table's own shape. */
export type Entry = TableModel;

/** The table's grading, and where each model ranks for your languages. */
export type Facts = Grading & {
  /** Lower is a better fit; the uncurated after every curated model. */
  rankOf: (e: Entry) => number;
};

export interface Lists {
  /** On disk: the one in use first, then best fit; custom and old last. */
  yours: Entry[];
  /** Curated, not on disk, hearing all your languages: the picks first. */
  fits: Entry[];
  /** Curated, not on disk, missing one of your languages. */
  partial: Entry[];
  /** Not curated, not on disk: only found by searching. */
  untested: Entry[];
}

const KIND_ORDER = { curated: 0, catalog: 0, custom: 1, legacy: 2 } as const;

/** Every model on the page, graded for `spoken_languages`, in sections. */
export const useModelEntries = () => {
  const { t } = useTranslation();
  const { getSetting } = useSettings();
  const spoken = getSetting("spoken_languages");
  const langs = spoken?.length ? spoken : suggestedLanguages();
  const { groups, grading } = useModelCatalog(langs);
  const infos = useModelStore((s) => s.models);
  const current = useModelStore((s) => s.currentModel);

  const entries = useMemo(
    () =>
      infos
        // Old .bin downloads only while they're still on disk.
        .filter((info) => !isLegacyModel(info) || info.is_downloaded)
        .map((info) => toTableModel(info, t)),
    [infos, t],
  );

  const facts = useMemo((): Facts => {
    const rank = new Map(
      [...groups.picks, ...groups.others, ...groups.partial].map((r, i) => [
        r.model.id,
        i,
      ]),
    );
    return {
      ...grading,
      rankOf: (e) => {
        const r = e.model && rank.get(e.model.id);
        if (r != null) return r;
        if (!e.model) return 10_000;
        return (
          1000 +
          grading.missing(e.model).length * 100 +
          (averageError(e.model, grading.langs) ?? 99)
        );
      },
    };
  }, [groups, grading]);

  const lists = useMemo((): Lists => {
    const infoById = new Map(infos.map((i) => [i.id, i]));
    // A download stays where it was pressed until it's done.
    const onDisk = (e: Entry) => !!infoById.get(e.id)?.is_downloaded;
    const byFit = (a: Entry, b: Entry) => facts.rankOf(a) - facts.rankOf(b);
    const yours = entries
      .filter(onDisk)
      .sort(
        (a, b) =>
          Number(b.id === current) - Number(a.id === current) ||
          KIND_ORDER[a.kind] - KIND_ORDER[b.kind] ||
          byFit(a, b),
      );
    const rest = entries.filter((e) => !onDisk(e));
    const curated = rest.filter((e) => e.kind === "curated").sort(byFit);
    return {
      yours,
      fits: curated.filter((e) => !facts.missing(e.model).length),
      partial: curated.filter((e) => facts.missing(e.model).length > 0),
      untested: rest.filter((e) => e.kind !== "curated").sort(byFit),
    };
  }, [entries, infos, current, facts]);

  return { facts, lists };
};

/* ---------------- where a model is, and what pressing it does ---------------- */

/** Where a model is: in use, on disk, on its way, or only in the catalog. */
export type Place =
  | "active"
  | "loading"
  | "ready"
  | "downloading"
  | "checking"
  | "remote";

export const usePlace = (id: string): Place => {
  const switching = useModelPickStore((s) => s.switching === id);
  const state = useModelStore((s) => downloadStateOf(s, id).state);
  const current = useModelStore((s) => s.currentModel === id);
  if (switching) return "loading";
  if (state === "checking" || state === "downloading") return state;
  // A stale selection must never make a missing model look in use.
  if (state !== "ready") return "remote";
  return current ? "active" : "ready";
};

export const useIsTarget = (id: string) =>
  useModelPickStore((s) => s.target === id);
