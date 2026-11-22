import type { OverlayAccent } from "@/bindings";

export const DEFAULT_OVERLAY_ACCENT: OverlayAccent = "cherenkov";

export const OVERLAY_ACCENTS = {
  cherenkov: { name: "Cherenkov Blue", color: "#47a6ff", deep: "#3166fd" },
  euclidian: { name: "Euclidian Teal", color: "#26d9c5", deep: "#007e80" },
  ptolemic: { name: "Ptolemic Gold", color: "#ffbf47", deep: "#ba6214" },
  newtonian: { name: "Newtonian Violet", color: "#b698ff", deep: "#7747e8" },
  maxwells: { name: "Maxwells Magenta", color: "#ff7abf", deep: "#c72a7f" },
  hertzes: { name: "Hertzes Green", color: "#9ede56", deep: "#3b920f" },
} satisfies Record<
  OverlayAccent,
  { name: string; color: string; deep: string }
>;
