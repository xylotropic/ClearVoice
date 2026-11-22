import { useEffect, type ReactNode } from "react";
import { Trans, useTranslation } from "react-i18next";
import { commands } from "@/bindings";
import optics from "@/assets/prism-optics.webp";
import { useSettings } from "@/hooks/useSettings";
import { useShortcutCapture } from "@/hooks/useShortcutCapture";
import type { OSType } from "@/lib/utils/keyboard";
import { Button } from "../../ui/Button";
import { OnboardingShell, ScreenHeader, ScreenMain } from "../OnboardingShell";
import { ShortcutControl } from "../ShortcutControl";
import { useOnboardingStore } from "../onboardingStore";

interface DemoProps {
  progress: { index: number; count: number };
  os: OSType;
  ready: boolean;
  downloadFailed: boolean;
  download: ReactNode;
  onRetry: () => void;
  onBack: () => void;
  onContinue: () => void;
}

export function Demo({
  progress,
  os,
  ready,
  downloadFailed,
  download,
  onRetry,
  onBack,
  onContinue,
}: DemoProps) {
  const { t } = useTranslation();
  const { getSetting } = useSettings();
  const { preview } = useOnboardingStore();
  const binding = getSetting("bindings")?.transcribe?.current_binding ?? "";
  const capture = useShortcutCapture("transcribe", os, {
    inert: preview,
    escapeCancels: true,
  });

  useEffect(() => {
    if (!preview) commands.initializeShortcuts().catch(console.error);
  }, [preview]);

  return (
    <OnboardingShell
      progress={progress}
      onBack={onBack}
      hint={download}
      primary={
        <Button
          variant="primary"
          size="lg"
          disabled={!ready && !downloadFailed}
          onClick={downloadFailed ? onRetry : onContinue}
        >
          {t(
            downloadFailed
              ? "onboarding.download.retryDownload"
              : "onboarding.demo.tryIt",
          )}
        </Button>
      }
    >
      <ScreenMain className="overflow-y-auto py-4">
        <div className="flex w-full max-w-[460px] flex-col items-center gap-5">
          <img
            src={optics}
            alt=""
            width={1280}
            height={720}
            className="prism-artwork h-40 w-80 object-contain motion-safe:animate-rise"
          />
          <ScreenHeader
            title={t("onboarding.demo.title")}
            sub={
              <Trans
                i18nKey="onboarding.demo.hold"
                components={[
                  <span key="cursor" />,
                  <span key="hold" />,
                  <span key="release" />,
                ]}
              />
            }
            subClassName="mx-auto max-w-[355px]"
          />
          <ShortcutControl binding={binding} os={os} capture={capture} />
        </div>
      </ScreenMain>
    </OnboardingShell>
  );
}
