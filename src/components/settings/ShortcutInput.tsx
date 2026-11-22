import React, { useRef } from "react";
import { useTranslation } from "react-i18next";
import { keycapLabel, spaceDoesNotClick } from "../../lib/utils/keyboard";
import { CapturedKeys, Keycaps } from "../shared/Keycaps";
import { ResetButton } from "../ui/ResetButton";
import { SettingContainer } from "../ui/SettingContainer";
import { useSettings } from "../../hooks/useSettings";
import { useOsType } from "../../hooks/useOsType";
import { useShortcutCapture } from "../../hooks/useShortcutCapture";
import { usePressAway } from "../../hooks/usePressAway";

interface ShortcutInputProps {
  descriptionMode?: "inline" | "tooltip";
  grouped?: boolean;
  shortcutId: string;
  disabled?: boolean;
}

/**
 * A binding's shortcut; click to record a new one. Clicking elsewhere cancels;
 * Escape is recorded like any key (Cancel's default is Escape).
 */
export const ShortcutInput: React.FC<ShortcutInputProps> = ({
  descriptionMode = "tooltip",
  grouped = false,
  shortcutId,
  disabled = false,
}) => {
  const { t } = useTranslation();
  const { getSetting, resetBinding, isUpdating, isLoading } = useSettings();
  const osType = useOsType();
  const { capturing, partial, start, cancel } = useShortcutCapture(
    shortcutId,
    osType,
  );
  const shortcutRef = useRef<HTMLDivElement | null>(null);

  const bindings = getSetting("bindings") || {};

  usePressAway(capturing, shortcutRef, cancel);

  // If still loading, show loading state
  if (isLoading) {
    return (
      <SettingContainer
        title={t("settings.general.shortcut.title")}
        description={t("settings.general.shortcut.description")}
        descriptionMode={descriptionMode}
        grouped={grouped}
      >
        <div className="text-sm text-ink-3">
          {t("settings.general.shortcut.loading")}
        </div>
      </SettingContainer>
    );
  }

  // If no bindings are loaded, show empty state
  if (Object.keys(bindings).length === 0) {
    return (
      <SettingContainer
        title={t("settings.general.shortcut.title")}
        description={t("settings.general.shortcut.description")}
        descriptionMode={descriptionMode}
        grouped={grouped}
      >
        <div className="text-sm text-ink-3">
          {t("settings.general.shortcut.none")}
        </div>
      </SettingContainer>
    );
  }

  const binding = bindings[shortcutId];
  if (!binding) {
    return (
      <SettingContainer
        title={t("settings.general.shortcut.title")}
        description={t("settings.general.shortcut.notFound")}
        descriptionMode={descriptionMode}
        grouped={grouped}
      >
        <div className="text-sm text-ink-3">
          {t("settings.general.shortcut.none")}
        </div>
      </SettingContainer>
    );
  }

  // Get translated name and description for the binding
  const translatedName = t(
    `settings.general.shortcut.bindings.${shortcutId}.name`,
    binding.name,
  );
  const translatedDescription = t(
    `settings.general.shortcut.bindings.${shortcutId}.description`,
    binding.description,
  );

  return (
    <SettingContainer
      title={translatedName}
      description={translatedDescription}
      descriptionMode={descriptionMode}
      grouped={grouped}
      disabled={disabled}
      layout="horizontal"
    >
      <div className="flex items-center space-x-1">
        {capturing ? (
          <div
            ref={shortcutRef}
            className="flex min-h-9 items-center px-2.5 pb-1"
          >
            <CapturedKeys
              partial={partial}
              osType={osType}
              size="line"
              slotLabel={t("settings.general.shortcut.pressKeys")}
            />
          </div>
        ) : (
          <button
            type="button"
            disabled={disabled || isUpdating(`binding_${shortcutId}`)}
            className="group/keycaps flex min-h-9 min-w-12 cursor-pointer items-center justify-center rounded-lg px-2.5 pb-1 hover:bg-wash focus-visible:outline-2 focus-visible:outline-logo-primary disabled:cursor-not-allowed disabled:opacity-50"
            onClick={start}
            title={translatedName}
            aria-label={`${translatedName}, ${keycapLabel(binding.current_binding, osType)}`}
            {...spaceDoesNotClick}
          >
            <Keycaps
              binding={binding.current_binding}
              osType={osType}
              size="line"
            />
          </button>
        )}
        <ResetButton
          ariaLabel={t("common.resetSetting", { setting: translatedName })}
          onClick={() => resetBinding(shortcutId)}
          disabled={isUpdating(`binding_${shortcutId}`)}
        />
      </div>
    </SettingContainer>
  );
};
