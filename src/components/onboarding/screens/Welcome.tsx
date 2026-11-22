import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "../../ui/Button";
import { Radio } from "../../ui/Radio";
import optics from "@/assets/prism-optics.webp";
import {
  LanguageOptions,
  LanguageSearchField,
  useLanguagePicker,
} from "../../shared/LanguagePicker";
import { OnboardingShell, ScreenHeader } from "../OnboardingShell";
import { AppLanguageMenu } from "../AppLanguageMenu";
import { useOnboardingStore } from "../onboardingStore";
import { CHINESE_SCRIPTS, isChinese } from "@/lib/utils/languageSuggestions";
import { CURATED_ASR, isWeakLanguage } from "@/lib/models/catalog";
import { modelMatchesLanguage } from "@handy-computer/models";
import { getSupportedLanguage } from "@/i18n";
import { languageList } from "@/lib/constants/languages";
import { useSettings } from "@/hooks/useSettings";

interface WelcomeProps {
  progress: { index: number; count: number };
  onContinue: () => void;
}

/** Screen 1: greeting, spoken languages, and Chinese script. */
export const Welcome: React.FC<WelcomeProps> = ({ progress, onContinue }) => {
  const { t, i18n } = useTranslation();
  const { updateSetting } = useSettings();
  const { languages, script, modelId, preview, set } = useOnboardingStore();
  const picker = useLanguagePicker({
    languages,
    onChange: (next) => {
      // A model picked for other languages no longer counts as the pick.
      const picked = CURATED_ASR.find((m) => m.id === modelId);
      const stillFits =
        !picked || next.every((l) => modelMatchesLanguage(picked, l));
      set({
        languages: next,
        ...(stillFits ? {} : { modelId: null }),
      });
    },
  });
  const [searching, setSearching] = useState(false);

  const ui = i18n.language;
  const chinese = languages.filter(isChinese);
  const weak = languages.filter(isWeakLanguage);

  const hint = !languages.length
    ? t("onboarding.welcome.hint.pickOne")
    : weak.length
      ? t("onboarding.welcome.hint.weak", {
          count: weak.length,
          languages: languageList(weak, ui),
        })
      : "";

  // What the menus are in right now (a preview never writes the setting).
  const uiLanguage = getSupportedLanguage(ui) || "en";
  const changeUiLanguage = (code: string) => {
    i18n.changeLanguage(code);
    if (!preview) updateSetting("app_language", code);
  };

  return (
    <OnboardingShell
      progress={progress}
      pill={<AppLanguageMenu value={uiLanguage} onChange={changeUiLanguage} />}
      hint={hint}
      hintTone={weak.length ? "warning" : "quiet"}
      primary={
        <Button
          variant="primary"
          size="lg"
          disabled={!languages.length}
          onClick={onContinue}
        >
          {t("onboarding.shell.continue")}
        </Button>
      }
    >
      <div className="flex h-full min-h-0 flex-col items-center justify-center-safe overflow-y-auto px-gutter py-3 text-center">
        <img
          src={optics}
          alt=""
          width={1280}
          height={720}
          className={`prism-artwork w-72 shrink-0 object-contain transition-[height] duration-300 ${searching ? "h-24" : "h-40"}`}
        />
        <ScreenHeader
          title={t("onboarding.welcome.title")}
          sub={t("onboarding.welcome.subtitle")}
        />

        <div
          className="mt-lead flex min-h-[50px] w-full max-w-[520px] flex-col overflow-hidden rounded-card border border-line-strong bg-background focus-within:border-background-ui focus-within:ring-2 focus-within:ring-logo-primary/30"
          onFocus={() => setSearching(true)}
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget))
              setSearching(false);
          }}
        >
          <LanguageSearchField
            picker={picker}
            inputClassName="min-w-[120px] text-body"
            aria-expanded={searching}
            onKeyDown={(event) => {
              if (event.key === "Escape") event.currentTarget.blur();
              else picker.onKeyDown(event);
            }}
          />
          {searching && (
            <div
              role="group"
              aria-label={t("onboarding.welcome.languagesLabel")}
              className="grid max-h-32 min-h-16 grid-cols-3 content-start gap-0.5 overflow-y-auto border-t border-line p-1.5 text-start"
            >
              <LanguageOptions
                picker={picker}
                noMatch={t("onboarding.welcome.noMatch", {
                  query: picker.query,
                })}
                emptyClassName="p-[24px]"
              />
            </div>
          )}
        </div>

        {chinese.length > 0 && (
          <div className="w-full animate-rise pt-[12px] text-start">
            <p className="mt-0 mb-[8px] text-small font-semibold text-text">
              {t("onboarding.welcome.chinese.question", {
                languages: languageList(chinese, ui),
              })}
            </p>
            <div
              role="radiogroup"
              aria-label={t("onboarding.welcome.chinese.label")}
              className="flex flex-wrap gap-[8px]"
            >
              {CHINESE_SCRIPTS.map((s) => {
                const picked = script === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    role="radio"
                    aria-checked={picked}
                    onClick={() => set({ script: s.id })}
                    className={`inline-flex h-[34px] cursor-pointer items-center gap-[8px] rounded-control border-[1.5px] bg-background ps-[10px] pe-[14px] text-small font-semibold text-text ${
                      picked
                        ? "border-plum-pick"
                        : "border-line-strong hover:border-ink-3"
                    }`}
                  >
                    <Radio checked={picked} />
                    <span>
                      <span lang={s.lang} className="font-cjk-subset">
                        {s.native}
                      </span>{" "}
                      {t(`onboarding.welcome.chinese.${s.id}`)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </OnboardingShell>
  );
};
