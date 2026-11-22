import { listen } from "@tauri-apps/api/event";
import { Undo2, X } from "lucide-react";
import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import "./RecordingOverlay.css";
import { LiveTranscript } from "./LiveTranscript";
import prismMark from "@/assets/prism-notch-icon.png";
import { DEFAULT_OVERLAY_ACCENT, OVERLAY_ACCENTS } from "@/lib/overlayAccent";
import { commands, events } from "@/bindings";
import type {
  Notice,
  OverlayAccent,
  StreamPhase,
  StreamPhaseEvent,
  StreamTextEvent,
  StreamWorkKind,
  TranscriptAnimation,
} from "@/bindings";
import { NoticeBadgeIcon } from "@/components/icons/NoticeBadgeIcon";
import i18n, { syncLanguageFromSettings } from "@/i18n";
import { noticeDisplay } from "@/lib/notices";
import type { ModelStateEvent } from "@/lib/types/events";
import { getLanguageDirection } from "@/lib/utils/rtl";

interface Cancellation {
  id: number;
  canUndo: boolean;
}

type OverlayState =
  | "recording"
  | "streaming"
  | "transcribing"
  | "processing"
  | "cancelled"
  | "notice"
  | "live_notice";

const isNoticeState = (state: OverlayState) =>
  state === "notice" || state === "live_notice";

// Number of reactive bars in the waveform (the simple, smoothed style shared by
// every overlay form). Mic levels arrive as 16 FFT buckets; we take the first N.
const IS_MAC = navigator.userAgent.includes("Macintosh");
const WAVE_BARS = IS_MAC ? 7 : 9;

// Only call out a model load in the Live preview once it has run this long.
// Warm loads finish in well under this (~0.2s on Apple Silicon, ~1.5s on a
// Windows CPU backend), so the common case never flashes a loading notice while
// the user is speaking; cold loads can take 40s+.
const SLOW_MODEL_LOAD_MS = 2000;

// Matches the delay in `hide_recording_overlay`, so a notice can fade out.
const OVERLAY_FADE_MS = 300;

// 13px padding on each side, the 16px badge and its 7px gap.
const NOTICE_PILL_CHROME = 49;

// Each side needs 48pt for the waveform and its edge padding.
const MAX_CAMERA_WIDTH_FOR_WINGS = 180;

interface OverlayDisplayLayout {
  position: "top" | "bottom";
  cameraWidth: number;
  cameraHeight: number;
}

const RecordingOverlay: React.FC = () => {
  const { t } = useTranslation();
  const [isVisible, setIsVisible] = useState(false);
  const [state, setState] = useState<OverlayState>("recording");
  // `Stream::play()` returning does not mean hardware callbacks are flowing.
  // Stay visually in an arming state until the backend processes the first
  // actual microphone sample chunk.
  const [captureReady, setCaptureReady] = useState(false);
  const [animation, setAnimation] = useState<TranscriptAnimation>("sweep");
  const [accent, setAccent] = useState<OverlayAccent>(DEFAULT_OVERLAY_ACCENT);
  // Recording starts while the model loads in the background. Say so, otherwise
  // a cold start looks like an empty Live preview that ignores speech, then a
  // hung "Transcribing..." spinner. Once recording stops, any in-flight load is
  // the wait, so the working label reflects it immediately; the Live notice
  // waits for the load to be slow so fast loads don't flash it mid-speech.
  const [modelLoading, setModelLoading] = useState(false);
  const [modelLoadSlow, setModelLoadSlow] = useState(false);
  const modelLoadTimerRef = useRef<ReturnType<typeof setTimeout>>();
  // Latched per Live session: once the loading notice has opened the panel, keep
  // it open after the load so it doesn't collapse and reopen when text arrives.
  const [loadNoticeShown, setLoadNoticeShown] = useState(false);
  const [levels, setLevels] = useState<number[]>(Array(WAVE_BARS).fill(0));
  const [streamText, setStreamText] = useState<StreamTextEvent>({
    committed: "",
    tentative: "",
  });
  const [phase, setPhase] = useState<StreamPhase>("listening");
  const [workKind, setWorkKind] = useState<StreamWorkKind>("transcribing");
  const [elapsed, setElapsed] = useState(0);
  // Bumped on each new streaming session so the Live card remounts fresh (replays
  // the pop-in, and never animates in from the previous panel's open size).
  const [session, setSession] = useState(0);
  // Overlay placement (top vs bottom of the screen). The Live panel grows downward
  // from a top overlay (oldest line under the pill) and upward from a bottom one.
  const [position, setPosition] = useState<"top" | "bottom">(
    IS_MAC ? "top" : "bottom",
  );
  const [displayLayout, setDisplayLayout] = useState<OverlayDisplayLayout>();
  // True once live text overflows the cap. A top overlay fades its top edge only
  // while overflowing, so the resting first line stays crisp flush under the pill.
  const [overflowing, setOverflowing] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [cancellation, setCancellation] = useState<Cancellation | null>(null);
  const [pasteConfirmed, setPasteConfirmed] = useState(false);
  const [noticeWidth, setNoticeWidth] = useState<number>();
  const noticeProbeRef = useRef<HTMLSpanElement>(null);
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const smoothedLevelsRef = useRef<number[]>(Array(16).fill(0));
  // Live-text scroll-back: the text region "sticks" to the newest line while the
  // user is at the bottom; if they scroll up to read history, auto-follow pauses
  // until they scroll back down.
  const capRef = useRef<HTMLDivElement>(null);
  const pinnedRef = useRef(true);
  const direction = getLanguageDirection(i18n.language);

  useEffect(() => {
    const setupEventListeners = async () => {
      const unlistenNotice = await listen<Notice>("overlay-notice", (event) => {
        clearTimeout(fadeTimerRef.current);
        setNotice(event.payload);
      });

      const unlistenCancellation = await listen<Cancellation>(
        "overlay-cancelled",
        ({ payload }) => setCancellation(payload),
      );

      const unlistenLayout = await listen<OverlayDisplayLayout>(
        "overlay-display-layout",
        ({ payload }) => {
          setDisplayLayout(payload);
          setPosition(payload.position);
        },
      );

      const unlistenShow = await listen("show-overlay", async (event) => {
        const overlayState = event.payload as OverlayState;
        clearTimeout(fadeTimerRef.current);
        setPasteConfirmed(false);
        if (!isNoticeState(overlayState)) setNotice(null);
        if (overlayState !== "cancelled") setCancellation(null);
        // Reset synchronously before settings I/O. A fast microphone can emit
        // recording-ready while the awaits below are in flight; resetting after
        // them would overwrite that event and leave the overlay stuck arming.
        if (overlayState === "recording" || overlayState === "streaming") {
          setCaptureReady(false);
          smoothedLevelsRef.current = Array(16).fill(0);
          setLevels(Array(WAVE_BARS).fill(0));
          setStreamText({ committed: "", tentative: "" });
        }

        setState(overlayState);
        if (overlayState === "streaming") {
          setPhase("listening");
          setWorkKind("transcribing");
          setElapsed(0);
          setLoadNoticeShown(false);
          setSession((s) => s + 1);
        }
        setIsVisible(true);

        void syncLanguageFromSettings();
        // The Live panel flows downward from a top overlay and upward from a
        // bottom one; read the placement so the layout can flip to match.
        try {
          const settings = await commands.getAppSettings();
          if (settings.status === "ok") {
            setAnimation(settings.data.transcript_animation ?? "sweep");
            setAccent(settings.data.overlay_accent ?? DEFAULT_OVERLAY_ACCENT);
            setPosition(
              settings.data.overlay_position === "top" ? "top" : "bottom",
            );
          }
        } catch {
          // Keep the previous/default placement if settings can't be read.
        }
      });

      const unlistenHide = await listen("hide-overlay", () => {
        setIsVisible(false);
        setCaptureReady(false);
        // A notice keeps rendering while it fades. Dropping the transcript here
        // stops a later notice from showing an old session's text.
        clearTimeout(fadeTimerRef.current);
        fadeTimerRef.current = setTimeout(() => {
          setNotice(null);
          setStreamText({ committed: "", tentative: "" });
        }, OVERLAY_FADE_MS);
      });

      const unlistenPaste = await listen("paste-confirmed", () =>
        setPasteConfirmed(true),
      );

      const unlistenReady = await listen("recording-ready", () => {
        setElapsed(0);
        setCaptureReady(true);
      });

      const unlistenLevel = await listen<number[]>("mic-level", (event) => {
        const newLevels = event.payload as number[];
        // Exponential smoothing across the 16 buckets, then take the first N
        // bars for the shared waveform.
        const smoothed = smoothedLevelsRef.current.map((prev, i) => {
          const target = newLevels[i] || 0;
          // Respond quickly to the start of a syllable and release smoothly.
          const response = target > prev ? 0.58 : 0.27;
          return prev + (target - prev) * response;
        });
        smoothedLevelsRef.current = smoothed;
        setLevels(smoothed.slice(0, WAVE_BARS));
      });

      const unlistenStream = await events.streamTextEvent.listen((event) => {
        setStreamText(event.payload);
      });

      const unlistenPhase = await events.streamPhaseEvent.listen((event) => {
        const payload: StreamPhaseEvent = event.payload;
        setPhase(payload.phase);
        if (payload.kind) setWorkKind(payload.kind);
      });

      // The backend ends every `loading_started` with exactly one of completed
      // or failed, so only those end a load. Other events (e.g. `unloaded` from
      // the idle watcher) aren't ordered against an in-flight load and must not
      // clear it.
      const unlistenModel = await listen<ModelStateEvent>(
        "model-state-changed",
        (event) => {
          const type = event.payload.event_type;
          if (type === "loading_started") {
            clearTimeout(modelLoadTimerRef.current);
            setModelLoading(true);
            setModelLoadSlow(false);
            modelLoadTimerRef.current = setTimeout(
              () => setModelLoadSlow(true),
              SLOW_MODEL_LOAD_MS,
            );
          } else if (
            type === "loading_completed" ||
            type === "loading_failed"
          ) {
            clearTimeout(modelLoadTimerRef.current);
            setModelLoading(false);
            setModelLoadSlow(false);
          }
        },
      );

      return () => {
        unlistenNotice();
        unlistenCancellation();
        unlistenLayout();
        unlistenShow();
        unlistenHide();
        unlistenPaste();
        unlistenReady();
        unlistenLevel();
        unlistenStream();
        unlistenPhase();
        unlistenModel();
        clearTimeout(modelLoadTimerRef.current);
        clearTimeout(fadeTimerRef.current);
      };
    };

    const subscription = setupEventListeners();
    return () => {
      void subscription.then((unsubscribe) => unsubscribe());
    };
  }, []);

  // Elapsed capture timer starts only once microphone samples are flowing.
  useEffect(() => {
    if (state !== "streaming" || !isVisible || !captureReady) return;
    const id = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(id);
  }, [state, isVisible, captureReady]);

  // Stick to the bottom as text streams in — but only while pinned, so a user who
  // has scrolled up to read history isn't yanked back down by the next chunk.
  useLayoutEffect(() => {
    const el = capRef.current;
    if (!el) return;
    // Fade the top edge only once text actually overflows the cap.
    setOverflowing(el.scrollHeight > el.clientHeight + 1);
    if (pinnedRef.current) el.scrollTop = el.scrollHeight;
  }, [streamText]);

  // `session` re-runs this when a new Live session starts mid-load (e.g. a
  // retry during a cold load), since the reset doesn't change the other deps.
  useEffect(() => {
    if (modelLoadSlow && state === "streaming") setLoadNoticeShown(true);
  }, [modelLoadSlow, state, session]);

  // Each fresh streaming session starts pinned to the bottom, fade cleared.
  useEffect(() => {
    pinnedRef.current = true;
    setOverflowing(false);
  }, [session]);

  const shownNotice = notice && isNoticeState(state) ? notice : null;
  const noticeTitle = shownNotice
    ? t(noticeDisplay(shownNotice.code).title)
    : "";

  // CSS can't animate to an intrinsic width, so a notice pill gets a measured one.
  useLayoutEffect(() => {
    const probe = noticeProbeRef.current;
    if (!probe) return;
    setNoticeWidth(
      Math.ceil(probe.getBoundingClientRect().width) + NOTICE_PILL_CHROME,
    );
  }, [noticeTitle, isVisible]);

  if (!isVisible && !shownNotice) return null;

  const attached =
    IS_MAC && position === "top" && !!displayLayout?.cameraHeight;
  const wideCamera =
    attached && displayLayout.cameraWidth > MAX_CAMERA_WIDTH_FOR_WINGS;
  const stageClass = [
    "ov-stage",
    position,
    IS_MAC && "mac-notch",
    IS_MAC && position === "top" && "docked",
    attached && "attached",
    wideCamera && "below-camera",
    pasteConfirmed && "paste-confirmed",
  ]
    .filter(Boolean)
    .join(" ");
  const palette = OVERLAY_ACCENTS[accent];
  const stageStyle = {
    "--s-accent": palette.color,
    "--s-deep": palette.deep,
    "--camera-width": `${attached ? displayLayout.cameraWidth : 0}px`,
    "--camera-height": `${attached ? displayLayout.cameraHeight : 0}px`,
  } as React.CSSProperties;

  // Re-pin when the user is within ~a line of the bottom; unpin otherwise.
  const handleStreamScroll = () => {
    const el = capRef.current;
    if (!el) return;
    pinnedRef.current = el.scrollHeight - el.scrollTop - el.clientHeight <= 16;
  };

  const fmtTime = (s: number) =>
    `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  const transcribingLabel = modelLoading
    ? t("overlay.loadingModel")
    : t("overlay.transcribing");

  // ---- Shared building blocks (one visual language for every overlay form) ----
  const waveform = (
    <div
      className={`swave ${captureReady ? "ready" : "arming"}`}
      aria-hidden="true"
    >
      {levels.map((level, index) => {
        const center = (WAVE_BARS - 1) / 2;
        const taper = 1 - (0.45 * Math.abs(index - center)) / center;
        const height =
          3 +
          Math.pow(Math.max(0, Math.min(1, level)), 0.42) *
            taper *
            (IS_MAC ? 33 : 17);
        return <i key={index} style={{ height }} />;
      })}
    </div>
  );

  const cancelBtn = (
    <button
      className="sx"
      aria-label={t("settings.general.shortcut.bindings.cancel.name")}
      onClick={() => commands.cancelOperation()}
    >
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path
          d="M4 4 L12 12 M12 4 L4 12"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>
    </button>
  );

  // dot (left) | waveform (center) | timer + cancel (right) — same structure for
  // pill & panel, so the Live morph is a pure width change.
  const listeningRow = (showTimer: boolean, showCancel: boolean) => (
    <div
      className="sbase listening"
      data-speaking={
        (captureReady && levels.some((value) => value > 0.045)) || undefined
      }
    >
      <div className="sbase-l">
        <img className="smark" src={prismMark} width={24} height={24} alt="" />
      </div>
      {waveform}
      <div className="sbase-r">
        {showTimer && <span className="stimer">{fmtTime(elapsed)}</span>}
        {showCancel && cancelBtn}
      </div>
    </div>
  );

  // spinner (left) | label (center) | cancel (right) — same 3-zone grid as the
  // listening row, so the label is centered.
  const workingRow = (label: string, showCancel: boolean) => (
    <div className="sbase">
      <div className="sbase-l">
        <span className="sspinner" />
      </div>
      <span className="swork-label">{label}</span>
      <div className="sbase-r">{showCancel && cancelBtn}</div>
    </div>
  );

  const noticeRow = (
    <div className="sbase snotice">
      <NoticeBadgeIcon className="nglyph" />
      <span className="nlabel">{noticeTitle}</span>
    </div>
  );
  const noticeProbe = shownNotice && (
    <span ref={noticeProbeRef} className="nlabel nprobe" aria-hidden="true">
      {noticeTitle}
    </span>
  );
  const noticeClass = shownNotice ? `cnotice level-${shownNotice.level}` : "";
  const dismissNotice = shownNotice
    ? () => commands.dismissOverlayNotice()
    : undefined;

  if (state === "cancelled" && cancellation) {
    const resolve = (undo: boolean) =>
      commands.resolveCancellation(cancellation.id, undo);
    return (
      <div
        className={`${stageClass} ov-fade ${isVisible ? "show" : ""}`}
        dir={direction}
        style={stageStyle}
      >
        <div className="cancel-toast">
          <img src={prismMark} alt="" width={24} height={24} />
          <span className="cancel-toast-title" role="status">
            {t("overlay.cancelled")}
          </span>
          {cancellation.canUndo && (
            <button
              className="cancel-toast-undo"
              onClick={() => void resolve(true)}
            >
              <Undo2 aria-hidden="true" size={14} />
              {t("overlay.undoCancel")}
            </button>
          )}
          <button
            className="cancel-toast-dismiss"
            aria-label={t("common.close")}
            onClick={() => void resolve(false)}
          >
            <X aria-hidden="true" size={14} />
          </button>
        </div>
      </div>
    );
  }

  // ---- Live overlay: a pill that sculpts open into a panel ----
  const liveNotice = state === "live_notice" ? shownNotice : null;
  if (state === "streaming" || liveNotice) {
    const hasText =
      streamText.committed.length > 0 || streamText.tentative.length > 0;
    const working = !liveNotice && phase === "working";
    // A notice keeps the transcript; with none, the panel explains the notice.
    const noticeText =
      liveNotice && !hasText
        ? (noticeDisplay(liveNotice.code).explanation?.(t) ?? liveNotice.detail)
        : null;
    // While listening, a slow model load opens the panel with a notice where the
    // text would be, so speech that isn't transcribing yet doesn't look ignored.
    const loadingNotice = !liveNotice && modelLoadSlow && !working && !hasText;
    // Keep the panel open whenever there's text — even while finalizing — so the
    // transcript stays put under a working spinner instead of collapsing and
    // squishing the text mid-stream. Only fall back to the small working pill
    // when there was no text to preserve.
    const open = liveNotice
      ? hasText || !!noticeText
      : hasText || loadingNotice || (loadNoticeShown && !working);
    const collapsed = working && !hasText;

    return (
      <div
        dir={direction}
        className={stageClass}
        data-animation={animation}
        style={stageStyle}
      >
        {noticeProbe}
        <div
          key={session}
          className={`scard ${open ? "open" : ""} ${collapsed ? "working" : ""} ${
            isVisible ? "" : "leaving"
          } ${noticeClass}`}
          style={liveNotice && !open ? { width: noticeWidth } : undefined}
          onClick={dismissNotice}
        >
          <div className="stext">
            <div className="stext-clip">
              <div
                className={`stext-cap ${overflowing ? "overflowing" : ""}`}
                ref={capRef}
                onScroll={handleStreamScroll}
              >
                <p>
                  {loadingNotice && (
                    <span className="sloading">
                      {t("overlay.loadingModel")}
                    </span>
                  )}
                  {noticeText && <span className="ndetail">{noticeText}</span>}
                  <LiveTranscript {...streamText} animation={animation} />
                  {/* Drop the blinking caret once finalizing — it's no longer
                      capturing, and a static spinner conveys the work. */}
                  {!working && !loadingNotice && !liveNotice && (
                    <span className="scaret" />
                  )}
                </p>
              </div>
            </div>
          </div>
          {liveNotice
            ? noticeRow
            : working
              ? workingRow(
                  workKind === "polishing"
                    ? t("overlay.processing")
                    : transcribingLabel,
                  true,
                )
              : listeningRow(open, true)}
        </div>
      </div>
    );
  }

  // ---- Minimal overlay: exactly one row at a time — waveform (recording), or a
  // spinner + label (transcribing / processing). Never both. The pill animates its
  // width between them; the cancel button is in both rows so it stays put.
  const working = state === "transcribing" || state === "processing";
  const workLabel =
    state === "processing" ? t("overlay.processing") : transcribingLabel;

  return (
    <div
      dir={direction}
      className={`${stageClass} ov-fade ${isVisible ? "show" : ""}`}
      style={stageStyle}
    >
      {noticeProbe}
      <div
        className={`scard compact ${working && isVisible ? "cworking" : ""} ${noticeClass}`}
        style={shownNotice ? { width: noticeWidth } : undefined}
        onClick={dismissNotice}
      >
        {shownNotice
          ? noticeRow
          : working
            ? workingRow(workLabel, true)
            : listeningRow(false, true)}
      </div>
    </div>
  );
};

export default RecordingOverlay;
