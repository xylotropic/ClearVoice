// The preset sound names are also used in the custom sound picker.
/* eslint-disable i18next/no-literal-string */
import React from "react";
import { Play } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { SoundTheme } from "@/bindings";
import { ToggleSwitch } from "../ui/ToggleSwitch";
import { useSettings } from "../../hooks/useSettings";
import { useSettingsStore } from "@/stores/settingsStore";

const CUES = ["start", "stop", "cancel"] as const;

interface AudioFeedbackProps {
  descriptionMode?: "inline" | "tooltip";
  grouped?: boolean;
}

export const AudioFeedback: React.FC<AudioFeedbackProps> = React.memo(
  ({ descriptionMode = "tooltip", grouped = false }) => {
    const { t } = useTranslation();
    const { getSetting, updateSetting, isUpdating } = useSettings();
    const playTestSound = useSettingsStore((state) => state.playTestSound);
    const audioFeedbackEnabled = getSetting("audio_feedback") ?? false;
    const sounds = getSetting("recording_sounds") ?? {};
    const theme = getSetting("sound_theme") ?? "marimba";

    return (
      <div className="flex flex-col">
        <ToggleSwitch
          checked={audioFeedbackEnabled}
          onChange={(enabled) => updateSetting("audio_feedback", enabled)}
          isUpdating={isUpdating("audio_feedback")}
          label={t("settings.sound.audioFeedback.label")}
          description={t("settings.sound.audioFeedback.description")}
          descriptionMode={descriptionMode}
          grouped={grouped}
        />
        {audioFeedbackEnabled && (
          <div className="grid gap-1.5 border-t border-line px-4 py-2.5">
            {CUES.map((cue) => {
              const label = t(`settings.sound.cues.${cue}`);
              const selected = sounds[cue] ?? theme;
              return (
                <div
                  key={cue}
                  className="flex items-center justify-between gap-3 text-small text-ink-2"
                >
                  <label htmlFor={`recording-cue-${cue}`}>{label}</label>
                  <div className="flex items-center gap-2">
                    <select
                      id={`recording-cue-${cue}`}
                      className="min-w-24 rounded-md border border-line bg-wash px-2 py-1 text-text"
                      value={selected}
                      disabled={isUpdating("recording_sounds")}
                      onChange={(event) =>
                        updateSetting("recording_sounds", {
                          ...sounds,
                          [cue]: event.target.value as SoundTheme,
                        })
                      }
                    >
                      <option value="marimba">Soft Plop</option>
                      <option value="pop">Tap</option>
                      {(theme === "custom" || selected === "custom") && (
                        <option value="custom">
                          {t("settings.sound.cues.custom")}
                        </option>
                      )}
                    </select>
                    <button
                      type="button"
                      title={t("settings.sound.cues.preview", { cue: label })}
                      aria-label={t("settings.sound.cues.preview", {
                        cue: label,
                      })}
                      onClick={() => void playTestSound(cue)}
                      className="flex size-7 cursor-pointer items-center justify-center rounded-md text-plum hover:bg-wash"
                    >
                      <Play size={13} aria-hidden="true" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  },
);
