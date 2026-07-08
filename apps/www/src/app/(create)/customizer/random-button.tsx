"use client";

import * as React from "react";
import { useLocks } from "@/app/(create)/hooks/use-locks";
import { FONTS } from "@/app/(create)/lib/fonts";
import {
  applyBias,
  RANDOMIZE_BIASES,
  type RandomizeContext,
} from "@/app/(create)/lib/randomize-biases";
import { useDesignSystemSearchParams } from "@/app/(create)/lib/search-params";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { DEFAULT_CONFIG, useConfig } from "@/hooks/use-config";
import {
  BASE_COLORS,
  type FontHeadingValue,
  getThemesForBaseColor,
  iconLibraries,
  MENU_ACCENTS,
  MENU_COLORS,
  RADII,
  STYLES,
} from "@/registry/config";

function randomItem<T>(array: readonly T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

export function RandomButton() {
  const { locks } = useLocks();
  const [params, setParams] = useDesignSystemSearchParams();
  const [config, setConfig] = useConfig();
  const fontHeadingChoices = React.useMemo(
    () =>
      ["inherit", ...FONTS.map((f) => f.value)] as readonly FontHeadingValue[],
    []
  );

  const effectiveParams = React.useMemo(
    () => ({
      baseColor: params.baseColor ?? config.baseColor,
      chartColor: params.chartColor ?? config.chartColor,
      font: params.font ?? config.font,
      fontHeading: params.fontHeading ?? config.fontHeading,
      iconLibrary: params.iconLibrary ?? config.iconLibrary,
      menuAccent: params.menuAccent ?? config.menuAccent,
      menuColor: params.menuColor ?? config.menuColor,
      radius: params.radius ?? config.radius,
      style: params.style ?? config.style,
      theme: params.theme ?? config.theme,
    }),
    [
      params.baseColor,
      params.style,
      params.theme,
      params.chartColor,
      params.font,
      params.fontHeading,
      params.radius,
      params.iconLibrary,
      params.menuAccent,
      params.menuColor,
      config.baseColor,
      config.style,
      config.theme,
      config.chartColor,
      config.font,
      config.fontHeading,
      config.radius,
      config.iconLibrary,
      config.menuAccent,
      config.menuColor,
    ]
  );

  const handleRandomize = React.useCallback(() => {
    // Use current value if locked, otherwise randomize.
    const pick = <K extends keyof typeof effectiveParams>(
      key: K,
      randomValue: () => (typeof effectiveParams)[K]
    ) => (locks.has(key) ? effectiveParams[key] : randomValue());

    const baseColor = pick("baseColor", () => randomItem(BASE_COLORS).name);
    const selectedStyle = pick("style", () => randomItem(STYLES).name);

    // Build context for bias application.
    const context: RandomizeContext = {
      baseColor,
      style: selectedStyle,
    };

    const availableThemes = getThemesForBaseColor(baseColor);
    const availableFonts = applyBias(FONTS, context, RANDOMIZE_BIASES.fonts);
    const availableRadii = applyBias(RADII, context, RANDOMIZE_BIASES.radius);

    const selectedTheme = pick("theme", () => randomItem(availableThemes).name);
    const selectedChartColor = pick(
      "chartColor",
      () => randomItem(availableThemes).name
    );
    const selectedFont = pick("font", () => randomItem(availableFonts).value);
    const selectedFontHeading = pick("fontHeading", () =>
      randomItem(fontHeadingChoices)
    );
    const selectedRadius = pick(
      "radius",
      () => randomItem(availableRadii).name
    );
    const selectedIconLibrary = pick(
      "iconLibrary",
      () => randomItem(Object.values(iconLibraries)).name
    );
    const selectedMenuAccent = pick(
      "menuAccent",
      () => randomItem(MENU_ACCENTS).value
    );
    const selectedMenuColor = pick(
      "menuColor",
      () => randomItem(MENU_COLORS).value
    );

    // Update context with selected values for potential future biases.
    context.theme = selectedTheme;
    context.font = selectedFont;
    context.radius = selectedRadius;

    const newValues = {
      baseColor,
      chartColor: selectedChartColor,
      font: selectedFont,
      fontHeading: selectedFontHeading,
      iconLibrary: selectedIconLibrary,
      menuAccent: selectedMenuAccent,
      menuColor: selectedMenuColor,
      radius: selectedRadius,
      style: selectedStyle,
      theme: selectedTheme,
    };

    // Update URL params and config storage
    // Only include values in the URL if they differ from the defaults
    const paramsToUpdate = Object.fromEntries(
      Object.entries(newValues).map(([key, value]) => [
        key,
        value === (DEFAULT_CONFIG as any)[key] ? null : value,
      ])
    );
    setParams(paramsToUpdate);
    setConfig((prev) => ({ ...prev, ...newValues }));
  }, [setParams, setConfig, locks, effectiveParams, fontHeadingChoices]);

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.key === "r" || e.key === "R") && !e.metaKey && !e.ctrlKey) {
        if (
          (e.target instanceof HTMLElement && e.target.isContentEditable) ||
          e.target instanceof HTMLInputElement ||
          e.target instanceof HTMLTextAreaElement ||
          e.target instanceof HTMLSelectElement
        ) {
          return;
        }

        e.preventDefault();
        handleRandomize();
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [handleRandomize]);

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            className="site-rounded-xl sm:site-rounded-lg md:site-rounded-lg in-data-[slot=sheet-content]:site-rounded-lg h-[calc(--spacing(13.5))] w-[140px] touch-manipulation select-none justify-between border border-site-foreground/10 bg-site-muted/50 focus-visible:border-transparent focus-visible:ring-1 md:w-full in-data-[slot=sheet-content]:w-full md:border-transparent in-data-[slot=sheet-content]:border-transparent md:bg-transparent in-data-[slot=sheet-content]:bg-transparent md:pr-3.5! in-data-[slot=sheet-content]:pr-3.5! md:pl-2! in-data-[slot=sheet-content]:pl-2!"
            onClick={handleRandomize}
            size="sm"
            variant="ghost"
          >
            <div className="flex flex-col justify-start text-left">
              <div className="text-site-muted-foreground text-xs">Shuffle</div>
              <div className="font-medium text-site-foreground text-sm">
                Try Random
              </div>
            </div>
            <Kbd className="hidden bg-site-foreground/10 text-site-foreground md:flex in-data-[slot=sheet-content]:flex">
              R
            </Kbd>
          </Button>
        }
      />
      <TooltipContent side="left">
        Use browser back/forward to navigate history
      </TooltipContent>
    </Tooltip>
  );
}
