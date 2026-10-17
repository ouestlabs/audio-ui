"use client";

import * as React from "react";
import { RandomButton } from "@/components/customizer/actions/random-button";
import { ResetButton } from "@/components/customizer/actions/reset-button";
import { MenuAccentPicker } from "@/components/customizer/pickers/accent-picker";
import { BaseColorPicker } from "@/components/customizer/pickers/base-color-picker";
import { BasePicker } from "@/components/customizer/pickers/base-picker";
import { ChartColorPicker } from "@/components/customizer/pickers/chart-color-picker";
import { FontPicker } from "@/components/customizer/pickers/font-picker";
import { IconLibraryPicker } from "@/components/customizer/pickers/icon-library-picker";
import { MenuColorPicker } from "@/components/customizer/pickers/menu-picker";
import { RadiusPicker } from "@/components/customizer/pickers/radius-picker";
import { StylePicker } from "@/components/customizer/pickers/style-picker";
import { ThemePicker } from "@/components/customizer/pickers/theme-picker";
import { FieldGroup } from "@/components/ui/field";
import { useConfig } from "@/hooks/use-config";
import { FONT_HEADING_OPTIONS, FONTS } from "@/lib/design-system/fonts";
import { useDesignSystemSearchParams } from "@/lib/design-system/search-params";
import { getThemesForBaseColor, STYLES } from "@/registry/config";

interface CustomizerSidebarContentProps {
  anchorRef: React.RefObject<HTMLDivElement | null>;
  isMobile: boolean;
  /** `list` stacks the choices down a column; `strip` lays them in one row to swipe along, for a short panel. */
  layout?: "list" | "strip";
}

export function CustomizerSidebarContent({
  isMobile,
  anchorRef,
  layout = "list",
}: CustomizerSidebarContentProps) {
  const [params] = useDesignSystemSearchParams();
  const [config] = useConfig();

  const effectiveBaseColor = params.baseColor ?? config.baseColor;

  const availableThemes = React.useMemo(
    () => getThemesForBaseColor(effectiveBaseColor),
    [effectiveBaseColor]
  );

  const strip = layout === "strip";

  const pickers = (
    <>
      <BasePicker anchorRef={anchorRef} isMobile={isMobile} />
      <StylePicker anchorRef={anchorRef} isMobile={isMobile} styles={STYLES} />
      <BaseColorPicker anchorRef={anchorRef} isMobile={isMobile} />
      <ThemePicker
        anchorRef={anchorRef}
        isMobile={isMobile}
        themes={availableThemes}
      />
      <ChartColorPicker anchorRef={anchorRef} isMobile={isMobile} />
      <IconLibraryPicker anchorRef={anchorRef} isMobile={isMobile} />
      <FontPicker
        anchorRef={anchorRef}
        fonts={FONT_HEADING_OPTIONS}
        isMobile={isMobile}
        label="Heading"
        param="fontHeading"
      />
      <FontPicker
        anchorRef={anchorRef}
        fonts={FONTS}
        isMobile={isMobile}
        label="Font"
        param="font"
      />
      <RadiusPicker anchorRef={anchorRef} isMobile={isMobile} />
      <MenuColorPicker anchorRef={anchorRef} isMobile={isMobile} />
      <MenuAccentPicker anchorRef={anchorRef} isMobile={isMobile} />
    </>
  );

  return (
    <>
      <div
        className={
          strip
            ? "no-scrollbar scroll-fade-x snap-x overflow-x-auto overflow-y-hidden overscroll-x-contain"
            : "scroll-fade-y no-scrollbar min-h-0 flex-1 overflow-y-auto"
        }
      >
        {strip ? (
          <div className="flex w-max flex-row gap-2 p-2">
            {pickers}
            <RandomButton />
            <ResetButton />
          </div>
        ) : (
          <div className="p-2">
            <FieldGroup className="flex flex-col gap-0">{pickers}</FieldGroup>
          </div>
        )}
      </div>
      {!strip && (
        <div className="mt-auto flex shrink-0 flex-col gap-0 p-3">
          <RandomButton />
          <ResetButton />
        </div>
      )}
    </>
  );
}
