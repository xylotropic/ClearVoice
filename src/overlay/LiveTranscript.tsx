import { memo } from "react";
import type { StreamTextEvent } from "@/bindings";

const segmenter =
  typeof Intl.Segmenter === "function"
    ? new Intl.Segmenter(undefined, { granularity: "word" })
    : null;

function segments(text: string): string[] {
  return segmenter
    ? Array.from(segmenter.segment(text), ({ segment }) => segment)
    : (text.match(/\s+|\S+/gu) ?? []);
}

export const LiveTranscript = memo(function LiveTranscript({
  committed,
  tentative,
}: StreamTextEvent) {
  const stable = segments(committed && tentative ? committed + " " : committed);

  return [...stable, ...segments(tentative)].map((text, index) =>
    // One sibling list keeps a word mounted when the decoder confirms it.
    /^\s+$/u.test(text) ? (
      <span key={`${index}:${text}`}>{text}</span>
    ) : (
      <span
        key={`${index}:${text}`}
        className={`transcript-word ${index < stable.length ? "committed" : "tentative"}`}
      >
        {text}
      </span>
    ),
  );
});
