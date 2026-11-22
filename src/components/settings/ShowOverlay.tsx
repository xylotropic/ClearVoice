import React from "react";
import { useTranslation } from "react-i18next";
import { Dropdown } from "../ui/Dropdown";
import { SettingContainer } from "../ui/SettingContainer";
import { useSettings } from "../../hooks/useSettings";
import type {
  OverlayAccent,
  OverlayPosition,
  OverlayStyle,
  TranscriptAnimation,
} from "@/bindings";

import { DEFAULT_OVERLAY_ACCENT, OVERLAY_ACCENTS } from "@/lib/overlayAccent";

const accentOptions = Object.entries(OVERLAY_ACCENTS).map(
  ([value, accent]) => ({
    value,
    label: (
      <span className="flex items-center gap-2">
        <span
          className="size-3 shrink-0 rounded-full"
          style={{ backgroundColor: accent.color }}
          aria-hidden="true"
        />
        {accent.name}
      </span>
    ),
  }),
);

interface ShowOverlayProps {
  descriptionMode?: "inline" | "tooltip";
  grouped?: boolean;
}

export const ShowOverlay: React.FC<ShowOverlayProps> = React.memo(
  ({ descriptionMode = "tooltip", grouped = false }) => {
    const { t } = useTranslation();
    const { getSetting, updateSetting, isUpdating } = useSettings();

    const styleOptions = [
      {
        value: "none",
        label: t("settings.advanced.overlay.style.options.none"),
      },
      {
        value: "minimal",
        label: t("settings.advanced.overlay.style.options.minimal"),
      },
      {
        value: "live",
        label: t("settings.advanced.overlay.style.options.live"),
      },
    ];

    const animationOptions = (
      [
        "encrypted",
        "sweep",
        "typewriter",
        "off",
      ] satisfies TranscriptAnimation[]
    ).map((value) => ({
      value,
      label: t(`settings.advanced.overlay.animation.${value}`),
    }));

    const positionOptions = [
      {
        value: "bottom",
        label: t("settings.advanced.overlay.position.options.bottom"),
      },
      {
        value: "top",
        label: t("settings.advanced.overlay.position.options.top"),
      },
    ];

    const selectedStyle = (getSetting("overlay_style") ||
      "live") as OverlayStyle;
    // Only "top" and "bottom" are selectable; anything else (empty, or a legacy
    // "none" from before the position was retired) falls back to "bottom".
    const selectedPosition: OverlayPosition =
      getSetting("overlay_position") === "top" ? "top" : "bottom";

    return (
      <>
        <SettingContainer
          title={t("settings.advanced.overlay.style.title")}
          description={t("settings.advanced.overlay.style.description")}
          descriptionMode={descriptionMode}
          grouped={grouped}
        >
          <Dropdown
            options={styleOptions}
            selectedValue={selectedStyle}
            onSelect={(value) =>
              updateSetting("overlay_style", value as OverlayStyle)
            }
            disabled={isUpdating("overlay_style")}
          />
        </SettingContainer>

        {selectedStyle === "live" && (
          <SettingContainer
            title={t("settings.advanced.overlay.animation.title")}
            descriptionMode={descriptionMode}
            grouped={grouped}
          >
            <Dropdown
              options={animationOptions}
              selectedValue={getSetting("transcript_animation") ?? "sweep"}
              onSelect={(value) =>
                updateSetting(
                  "transcript_animation",
                  value as TranscriptAnimation,
                )
              }
              disabled={isUpdating("transcript_animation")}
            />
          </SettingContainer>
        )}

        {selectedStyle !== "none" && (
          <SettingContainer
            title={t("settings.advanced.overlay.accent")}
            descriptionMode={descriptionMode}
            grouped={grouped}
          >
            <Dropdown
              options={accentOptions}
              selectedValue={
                getSetting("overlay_accent") ?? DEFAULT_OVERLAY_ACCENT
              }
              onSelect={(value) =>
                updateSetting("overlay_accent", value as OverlayAccent)
              }
              disabled={isUpdating("overlay_accent")}
            />
          </SettingContainer>
        )}

        {selectedStyle !== "none" && (
          <SettingContainer
            title={t("settings.advanced.overlay.position.title")}
            description={t("settings.advanced.overlay.position.description")}
            descriptionMode={descriptionMode}
            grouped={grouped}
          >
            <Dropdown
              options={positionOptions}
              selectedValue={selectedPosition}
              onSelect={(value) =>
                updateSetting("overlay_position", value as OverlayPosition)
              }
              disabled={isUpdating("overlay_position")}
            />
          </SettingContainer>
        )}
      </>
    );
  },
);
