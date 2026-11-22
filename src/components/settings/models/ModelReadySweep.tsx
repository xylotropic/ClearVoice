import { useEffect, useRef } from "react";
import { useModelPickStore } from "@/stores/modelPickStore";
import { useModelStore } from "@/stores/modelStore";

export function ModelReadySweep() {
  const selected = useModelStore((state) => state.currentModel);
  const switching = useModelPickStore((state) => state.switching);
  const last = useRef(selected);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (switching || !selected || last.current === selected) return;
    const changed = last.current !== "";
    last.current = selected;
    const canvas = canvasRef.current;
    if (
      !canvas ||
      !changed ||
      matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;

    let disposed = false;
    let stop: (() => void) | undefined;
    void import("glimm")
      .then(({ createShader, PALETTES, playSweep }) => {
        if (disposed) return;
        const shader = createShader({
          canvas,
          palette: PALETTES.azure,
          bandTight: 16,
        });
        if (!shader) return;
        const handle = playSweep(shader, {
          sweepMs: 570,
          outroMs: 130,
          peakAlpha: 0.28,
          onComplete: () => shader.destroy(),
        });
        stop = () => {
          handle.cancel();
          shader.destroy();
        };
      })
      .catch(() => {});

    return () => {
      disposed = true;
      stop?.();
    };
  }, [selected, switching]);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 size-full"
      aria-hidden="true"
    />
  );
}
