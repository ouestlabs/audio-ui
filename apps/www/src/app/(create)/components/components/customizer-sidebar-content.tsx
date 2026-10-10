"use client";

import * as React from "react";
import { MenuAccentPicker } from "@/app/(create)/customizer/accent-picker";
import { BaseColorPicker } from "@/app/(create)/customizer/base-color-picker";
import { BasePicker } from "@/app/(create)/customizer/base-picker";
import { ChartColorPicker } from "@/app/(create)/customizer/chart-color-picker";
import { FontPicker } from "@/app/(create)/customizer/font-picker";
import { IconLibraryPicker } from "@/app/(create)/customizer/icon-library-picker";
import { MenuColorPicker } from "@/app/(create)/customizer/menu-picker";
import { RadiusPicker } from "@/app/(create)/customizer/radius-picker";
import { RandomButton } from "@/app/(create)/customizer/random-button";
import { ResetButton } from "@/app/(create)/customizer/reset-button";
import { StylePicker } from "@/app/(create)/customizer/style-picker";
import { ThemePicker } from "@/app/(create)/customizer/theme-picker";
import { FONT_HEADING_OPTIONS, FONTS } from "@/app/(create)/lib/fonts";
import { useDesignSystemSearchParams } from "@/app/(create)/lib/search-params";
import { FieldGroup } from "@/components/ui/field";
import { useConfig } from "@/hooks/use-config";
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
        <div className="mt-auto flex shrink-0 flex-col gap-0 border-site-border/80 border-t p-3">
          <RandomButton />
          <ResetButton />
        </div>
      )}
    </>
  );
}
