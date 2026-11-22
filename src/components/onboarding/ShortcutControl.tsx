import { useTranslation } from "react-i18next";
import {
  keycapLabel,
  spaceDoesNotClick,
  type OSType,
} from "@/lib/utils/keyboard";
import type { useShortcutCapture } from "@/hooks/useShortcutCapture";
import { CapturedKeys, captureHintKey, Keycaps } from "../shared/Keycaps";

export function ShortcutControl({
  binding,
  os,
  capture,
  disabled,
  pressed,
}: {
  binding: string;
  os: OSType;
  capture: ReturnType<typeof useShortcutCapture>;
  disabled?: boolean;
  pressed?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      className="group/keycaps flex min-h-[54px] w-full cursor-pointer flex-wrap items-center justify-between gap-3 rounded-card border border-line bg-background px-4 py-2 text-small hover:bg-wash focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-background-ui"
      aria-label={
        capture.capturing
          ? t("onboarding.demo.cancel")
          : t("onboarding.try.changeKeys", { keys: keycapLabel(binding, os) })
      }
      disabled={disabled}
      {...spaceDoesNotClick}
      onClick={(event) => {
        if (event.detail) event.currentTarget.blur();
        if (capture.capturing) void capture.cancel();
        else void capture.start();
      }}
    >
      <span className="font-medium">
        {capture.capturing
          ? t(captureHintKey(capture.partial))
          : t("onboarding.done.panel.shortcut")}
      </span>
      <span className="flex items-center gap-3">
        {capture.capturing ? (
          <CapturedKeys partial={capture.partial} osType={os} size="line" />
        ) : (
          <Keycaps
            binding={binding}
            osType={os}
            size="line"
            pressed={pressed}
          />
        )}
        <span className="font-medium text-plum">
          {t(
            capture.capturing
              ? "onboarding.demo.cancel"
              : "onboarding.demo.change",
          )}
        </span>
      </span>
    </button>
  );
}
