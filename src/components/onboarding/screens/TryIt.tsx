import { useEffect, type ReactNode } from "react";
import { Trans, useTranslation } from "react-i18next";
import { ChevronRight } from "lucide-react";
import optics from "@/assets/prism-optics.webp";
import { useSettings } from "@/hooks/useSettings";
import { languageList } from "@/lib/constants/languages";
import type { CatalogModel } from "@/lib/models/catalog";
import type { OSType } from "@/lib/utils/keyboard";
import { MicrophoneDropdown } from "../../settings/MicrophoneSelector";
import { Keycaps } from "../../shared/Keycaps";
import { Button } from "../../ui/Button";
import { Switch } from "../../ui/Switch";
import { TextLink } from "../../ui/TextLink";
import { LinuxGuide } from "../LinuxGuide";
import { OnboardingShell, ScreenHeader, ScreenMain } from "../OnboardingShell";
import { ShortcutControl } from "../ShortcutControl";
import { useOnboardingStore } from "../onboardingStore";
import { useTryEngine } from "../useTryEngine";

interface TryItProps {
  progress: { index: number; count: number };
  os: OSType;
  finished: boolean;
  model: CatalogModel | undefined;
  ready: boolean;
  download: ReactNode;
  onChangeModel: () => void;
  onEdit: (to: "welcome" | "model") => void;
  onBack: () => void;
  onArrive: () => void;
  onUnfinish: () => void;
  onDone: () => void;
}

export function TryIt({
  progress,
  os,
  finished,
  model,
  ready,
  download,
  onChangeModel,
  onEdit,
  onBack,
  onArrive,
  onUnfinish,
  onDone,
}: TryItProps) {
  const { t, i18n } = useTranslation();
  const test = useTryEngine({ os });
  const { languages, atLogin, startHidden, set } = useOnboardingStore();
  const { refreshAudioDevices, getSetting } = useSettings();
  const toggle = getSetting("shortcut_activation") === "toggle";
  const { field, result, phase, waiting, lessons } = test;
  const languagesText = languageList(languages, i18n.language);
  const tested = lessons.hold || lessons.tap;
  const silent = result.kind === "silent";

  useEffect(() => {
    if (!finished) field.current?.focus({ preventScroll: true });
  }, [field, finished]);

  useEffect(() => {
    if (silent && !finished) refreshAudioDevices();
  }, [silent, finished, refreshAudioDevices]);

  const keys = (
    <Keycaps
      binding={test.shortcut}
      osType={os}
      size="line"
      pressed={test.keysDown}
    />
  );
  const shortcut = (
    <ShortcutControl
      binding={test.shortcut}
      os={os}
      capture={test.capture}
      disabled={phase !== "idle"}
      pressed={test.keysDown}
    />
  );
  const stepTitle = finished ? "onboarding.done.title" : "onboarding.try.title";
  const hint =
    os === "linux" ? (
      <LinuxGuide
        i18nKey={finished ? "onboarding.linux.done" : "onboarding.linux.tryIt"}
      />
    ) : null;

  const currentInstruction = () => {
    if (phase === "typing" && waiting) return t("overlay.transcribing");
    if (phase === "listening") {
      return (
        <Trans
          i18nKey={
            toggle || test.take === "tap"
              ? "onboarding.try.tapAgain"
              : "onboarding.try.letGo"
          }
          components={{ keys }}
        />
      );
    }
    switch (result.kind) {
      case "done":
      case "finale":
        return t("onboarding.try.doneHold");
      case "silent":
      case "nothingTyped":
      case "noWords":
        return (
          <>
            <span className="font-medium text-text">
              {t("onboarding.try." + result.kind)}
            </span>{" "}
            {t("onboarding.try." + result.kind + "Sub")}
          </>
        );
      default:
        return (
          <Trans
            i18nKey={toggle ? "onboarding.try.tapNext" : "onboarding.try.hold"}
            components={{ keys }}
          />
        );
    }
  };

  return (
    <OnboardingShell
      progress={progress}
      onBack={finished ? onUnfinish : onBack}
      hint={hint}
      primary={
        <Button
          variant={finished || tested ? "primary" : "outline"}
          size="lg"
          onClick={finished ? onDone : onArrive}
          disabled={phase !== "idle"}
        >
          {t(
            finished
              ? "onboarding.done.finish"
              : tested
                ? "onboarding.try.finish"
                : "onboarding.try.skip",
          )}
        </Button>
      }
    >
      <ScreenMain className="overflow-y-auto py-4">
        <div
          className="flex w-full max-w-[460px] flex-col items-center gap-4 motion-safe:animate-rise"
          key={stepTitle}
        >
          {finished && (
            <img
              src={optics}
              alt=""
              width={1280}
              height={720}
              className="prism-artwork h-[90px] w-44 object-contain"
            />
          )}
          <ScreenHeader
            title={t(stepTitle)}
            sub={
              finished
                ? t(
                    os === "macos"
                      ? "onboarding.done.subMac"
                      : "onboarding.done.subTray",
                  )
                : t("onboarding.try.subtitle")
            }
            subClassName="mx-auto max-w-[400px]"
          />
          {finished ? (
            <>
              {shortcut}
              <div className="w-full divide-y divide-line rounded-card border border-line text-start text-small">
                {[
                  {
                    name: t("onboarding.done.panel.languages"),
                    value: languagesText,
                    step: "welcome",
                  },
                  {
                    name: t("onboarding.done.panel.model"),
                    value: ready ? model?.name : download,
                    step: "model",
                  },
                ].map(({ name, value, step }) => (
                  <button
                    type="button"
                    key={step}
                    onClick={() =>
                      onEdit(step === "welcome" ? "welcome" : "model")
                    }
                    className="flex w-full cursor-pointer items-center gap-3 px-4 py-2.5 text-start hover:bg-wash"
                  >
                    <span className="shrink-0 font-medium">{name}</span>
                    <span className="ms-auto min-w-0 truncate text-end text-ink-2">
                      {value}
                    </span>
                    <ChevronRight
                      className="size-4 shrink-0 text-ink-3 rtl:rotate-180"
                      aria-hidden="true"
                    />
                  </button>
                ))}
                <div className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <span id="onboarding-at-login" className="font-medium">
                    {t("onboarding.done.atLogin")}
                  </span>
                  <Switch
                    checked={atLogin}
                    onChange={(value) => set({ atLogin: value })}
                    ariaLabelledBy="onboarding-at-login"
                  />
                </div>
                {atLogin && (
                  <div className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <span id="onboarding-start-hidden" className="font-medium">
                      {t("settings.advanced.startHidden.label")}
                    </span>
                    <Switch
                      checked={startHidden}
                      onChange={(value) => set({ startHidden: value })}
                      ariaLabelledBy="onboarding-start-hidden"
                    />
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <textarea
                ref={field}
                aria-label={t("onboarding.try.noteLabel")}
                placeholder={t("onboarding.try.placeholder")}
                className="min-h-[118px] w-full resize-none rounded-panel border border-line-strong bg-wash px-4 py-3 text-start leading-relaxed text-text placeholder:text-ink-3 focus:border-background-ui focus:outline-none focus:ring-2 focus:ring-logo-primary/30"
              />
              <div
                role="status"
                className="flex min-h-6 w-full flex-wrap items-center justify-center gap-1 text-small text-ink-2"
              >
                {currentInstruction()}
              </div>
              {silent && (
                <MicrophoneDropdown
                  placement="above"
                  tone="neutral"
                  onPicked={() => {
                    test.dismiss();
                    field.current?.focus({ preventScroll: true });
                  }}
                />
              )}
              {test.slowWait !== null && model && (
                <p className="text-small text-ink-2">
                  <Trans
                    i18nKey="onboarding.try.slowLine"
                    values={{
                      name: model.name,
                      wait: t("onboarding.try.seconds", {
                        value: new Intl.NumberFormat(i18n.language, {
                          maximumFractionDigits: 1,
                        }).format(test.slowWait),
                      }),
                    }}
                    components={{
                      faster: <TextLink onClick={onChangeModel} />,
                    }}
                  />
                </p>
              )}
              {shortcut}
            </>
          )}
        </div>
      </ScreenMain>
    </OnboardingShell>
  );
}
