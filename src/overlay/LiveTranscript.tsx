import { memo, useLayoutEffect, useRef, useState } from "react";
import type { StreamTextEvent, TranscriptAnimation } from "@/bindings";

const segmenter =
  typeof Intl.Segmenter === "function"
    ? new Intl.Segmenter(undefined, { granularity: "word" })
    : null;

function segments(text: string): string[] {
  return segmenter
    ? Array.from(segmenter.segment(text), ({ segment }) => segment)
    : (text.match(/\s+|\S+/gu) ?? []);
}

const cipherGlyphs = "0123456789+×÷*#=";

function scramble(text: string, shift: number): string {
  return Array.from(
    text,
    (glyph, index) =>
      cipherGlyphs[
        (glyph.codePointAt(0)! + index * 7 + shift) % cipherGlyphs.length
      ],
  ).join("");
}

function TranscriptWord({
  text,
  tentative,
  animation,
  delay,
}: {
  text: string;
  tentative: boolean;
  animation: TranscriptAnimation;
  delay: number;
}) {
  // Once a word starts appearing, confirmation shouldn't change its timing.
  const [enterDelay] = useState(delay);

  return (
    <span
      className={`transcript-word ${tentative ? "tentative" : "committed"}`}
    >
      <span
        className="transcript-glyphs"
        style={
          animation === "generate"
            ? { animationDelay: `${enterDelay}ms` }
            : undefined
        }
      >
        {text}
      </span>
      {animation === "encrypted" && (
        <span
          className="transcript-cipher"
          aria-hidden="true"
          data-first={scramble(text, 0)}
          data-second={scramble(text, 9)}
        />
      )}
    </span>
  );
}

export const LiveTranscript = memo(function LiveTranscript({
  committed,
  tentative,
  animation,
}: StreamTextEvent & { animation: TranscriptAnimation }) {
  const stable = segments(committed && tentative ? committed + " " : committed);
  const words = [...stable, ...segments(tentative)];
  const previousWords = useRef<string[]>([]);
  let shared = 0;
  while (
    shared < words.length &&
    words[shared] === previousWords.current[shared]
  ) {
    shared += 1;
  }
  useLayoutEffect(() => {
    previousWords.current = words;
  });

  return words.map((text, index) =>
    // One sibling list keeps a word mounted when the decoder confirms it.
    /^\s+$/u.test(text) ? (
      <span key={`${index}:${text}`}>{text}</span>
    ) : (
      <TranscriptWord
        key={`${index}:${text}`}
        text={text}
        tentative={index >= stable.length}
        animation={animation}
        delay={Math.min(96, Math.max(0, (index - shared) * 16))}
      />
    ),
  );
});
