"use client";

import * as React from "react";
import { LockButton } from "@/app/(create)/customizer/lock-button";
import {
  Picker,
  PickerContent,
  PickerGroup,
  PickerLabel,
  PickerRadioGroup,
  PickerRadioItem,
  PickerSeparator,
  PickerTrigger,
} from "@/app/(create)/customizer/picker";
import { FONTS } from "@/app/(create)/lib/fonts";
import { useDesignSystemSearchParams } from "@/app/(create)/lib/search-params";
import { DEFAULT_CONFIG, useConfig } from "@/hooks/use-config";
import { useMounted } from "@/hooks/use-mounted";
import type { FontHeadingValue, FontValue } from "@/registry/config";

type FontPickerOption = {
  name: string;
  value: string;
  type: string;
  font: {
    style: {
      fontFamily: string;
    };
  } | null;
};

export function FontPicker({
  label,
  param,
  fonts,
  isMobile,
  anchorRef,
}: {
  label: string;
  param: "font" | "fontHeading";
  fonts: readonly FontPickerOption[];
  isMobile: boolean;
  anchorRef: React.RefObject<HTMLDivElement | null>;
}) {
  const mounted = useMounted();
  const [params, setParams] = useDesignSystemSearchParams();
  const [config, setConfig] = useConfig();

  const currentValue =
    param === "font"
      ? (params.font ?? config.font)
      : (params.fontHeading ?? config.fontHeading);
  const handleFontChange = React.useCallback(
    (value: string) => {
      if (param === "font") {
        const next = value as FontValue;
        setParams({ font: next });
        setConfig((prev) => ({ ...prev, font: next }));
      } else {
        const next = value as FontHeadingValue;
        setParams({ fontHeading: next });
        setConfig((prev) => ({ ...prev, fontHeading: next }));
      }
    },
    [param, setParams, setConfig]
  );

  const currentFont = React.useMemo(
    () => fonts.find((font) => font.value === currentValue),
    [fonts, currentValue]
  );
  const currentBodyFont = React.useMemo(
    () => FONTS.find((font) => font.value === (params.font ?? config.font)),
    [params.font, config.font]
  );
  const bodyFontTitle =
    currentBodyFont?.name ??
    FONTS.find((f) => f.value === DEFAULT_CONFIG.font)?.name ??
    "Inter";

  const inheritsBodyFont =
    param === "fontHeading" && currentValue === "inherit";
  const displayFontName = inheritsBodyFont
    ? bodyFontTitle
    : (currentFont?.name ?? bodyFontTitle);
  const inheritFontLabel = bodyFontTitle;
  const groupedFonts = React.useMemo(() => {
    const pickerFonts =
      param === "fontHeading"
        ? fonts.filter((font) => font.value !== "inherit")
        : fonts;
    const groups = new Map<string, FontPickerOption[]>();

    for (const font of pickerFonts) {
      const existing = groups.get(font.type);
      if (existing) {
        existing.push(font);
        continue;
      }

      groups.set(font.type, [font]);
    }

    return Array.from(groups.entries()).map(([type, items]) => ({
      items,
      label: `${type.charAt(0).toUpperCase()}${type.slice(1)}`,
      type,
    }));
  }, [fonts, param]);

  return (
    <div className="group/picker relative">
      <Picker>
        <PickerTrigger>
          <div className="min-w-0 flex-1 pr-10 text-left">
            <div className="text-site-muted-foreground text-xs">{label}</div>
            <div className="truncate font-medium text-site-foreground text-sm">
              {mounted ? displayFontName : "..."}
            </div>
          </div>
          {mounted ? (
            <div
              className="-translate-y-1/2 pointer-events-none absolute top-1/2 right-4 flex size-4 select-none items-center justify-center text-base text-site-foreground"
              style={{
                fontFamily:
                  currentFont?.font?.style.fontFamily ??
                  currentBodyFont?.font.style.fontFamily ??
                  FONTS.find((f) => f.value === DEFAULT_CONFIG.font)?.font.style
                    .fontFamily,
              }}
            >
              Aa
            </div>
          ) : (
            <div
              aria-hidden
              className="-translate-y-1/2 pointer-events-none absolute top-1/2 right-4 size-4 select-none"
            />
          )}
        </PickerTrigger>
        <PickerContent
          align={isMobile ? "center" : "start"}
          anchor={isMobile ? anchorRef : undefined}
          className="max-h-96"
          side={isMobile ? "top" : "right"}
        >
          <PickerRadioGroup
            onValueChange={handleFontChange}
            value={currentValue ?? undefined}
          >
            {param === "fontHeading" ? (
              <>
                <PickerGroup>
                  <PickerRadioItem closeOnClick={isMobile} value="inherit">
                    {inheritFontLabel}
                  </PickerRadioItem>
                </PickerGroup>
                <PickerSeparator />
              </>
            ) : null}
            {groupedFonts.map((group) => (
              <PickerGroup key={group.type}>
                <PickerLabel>{group.label}</PickerLabel>
                {group.items.map((font) => (
                  <PickerRadioItem
                    closeOnClick={isMobile}
                    key={font.value}
                    value={font.value}
                  >
                    {font.name}
                  </PickerRadioItem>
                ))}
              </PickerGroup>
            ))}
          </PickerRadioGroup>
        </PickerContent>
      </Picker>
      <LockButton
        className="-translate-y-1/2 absolute top-1/2 right-10"
        param={param}
      />
    </div>
  );
}
