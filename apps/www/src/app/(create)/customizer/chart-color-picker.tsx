"use client";

import { useTheme } from "next-themes";
import * as React from "react";
import { LockButton } from "@/app/(create)/customizer/lock-button";
import {
  Picker,
  PickerContent,
  PickerGroup,
  PickerRadioGroup,
  PickerRadioItem,
  PickerSeparator,
  PickerTrigger,
} from "@/app/(create)/customizer/picker";
import { useDesignSystemSearchParams } from "@/app/(create)/lib/search-params";
import { useConfig } from "@/hooks/use-config";
import { useMounted } from "@/hooks/use-mounted";
import {
  BASE_COLORS,
  type ChartColorName,
  getThemesForBaseColor,
} from "@/registry/config";

const BASE_COLOR_NAMES = new Set(
  BASE_COLORS.map((baseColor) => baseColor.name)
);

export function ChartColorPicker({
  isMobile,
  anchorRef,
}: {
  isMobile: boolean;
  anchorRef: React.RefObject<HTMLDivElement | null>;
}) {
  const { resolvedTheme } = useTheme();
  const mounted = useMounted();
  const [params, setParams] = useDesignSystemSearchParams();
  const [config, setConfig] = useConfig();

  const effectiveBaseColor = params.baseColor ?? config.baseColor;

  const availableChartColors = React.useMemo(
    () => getThemesForBaseColor(effectiveBaseColor),
    [effectiveBaseColor]
  );

  const effectiveChartColor = params.chartColor ?? config.chartColor;

  const currentChartColor = React.useMemo(
    () =>
      availableChartColors.find((theme) => theme.name === effectiveChartColor),
    [availableChartColors, effectiveChartColor]
  );

  const currentChartColorIsBaseColor =
    BASE_COLOR_NAMES.has(effectiveChartColor);

  const baseColorThemes = React.useMemo(
    () =>
      availableChartColors.filter((theme) => BASE_COLOR_NAMES.has(theme.name)),
    [availableChartColors]
  );

  const otherThemes = React.useMemo(
    () =>
      availableChartColors.filter((theme) => !BASE_COLOR_NAMES.has(theme.name)),
    [availableChartColors]
  );

  React.useEffect(() => {
    if (!currentChartColor && availableChartColors.length > 0) {
      const next = availableChartColors[0].name;
      setParams({ chartColor: next });
      setConfig((prev) => ({ ...prev, chartColor: next }));
    }
  }, [currentChartColor, availableChartColors, setParams, setConfig]);

  const handleChartColorChange = React.useCallback(
    (value: string) => {
      const next = value as ChartColorName;
      setParams({ chartColor: next });
      setConfig((prev) => ({ ...prev, chartColor: next }));
    },
    [setParams, setConfig]
  );

  return (
    <div className="group/picker relative">
      <Picker>
        <PickerTrigger>
          <div className="min-w-0 flex-1 pr-10 text-left">
            <div className="text-site-muted-foreground text-xs">
              Chart Color
            </div>
            <div className="truncate font-medium text-site-foreground text-sm">
              {mounted ? (currentChartColor?.title ?? "...") : "..."}
            </div>
          </div>
          {mounted && (
            <div
              className="site-rounded-full -translate-y-1/2 pointer-events-none absolute top-1/2 right-4 size-4 select-none bg-(--color)"
              style={
                {
                  "--color":
                    currentChartColor?.cssVars?.[
                      (resolvedTheme as "light" | "dark") ?? "dark"
                    ]?.[
                      currentChartColorIsBaseColor
                        ? "muted-foreground"
                        : "primary"
                    ],
                } as React.CSSProperties
              }
            />
          )}
        </PickerTrigger>
        <PickerContent
          align={isMobile ? "center" : "start"}
          anchor={isMobile ? anchorRef : undefined}
          className="max-h-92"
          side={isMobile ? "top" : "right"}
        >
          <PickerRadioGroup
            onValueChange={handleChartColorChange}
            value={currentChartColor?.name}
          >
            <PickerGroup>
              {baseColorThemes.map((theme) => (
                <PickerRadioItem
                  closeOnClick={isMobile}
                  key={theme.name}
                  value={theme.name}
                >
                  <div className="flex items-start gap-2">
                    {mounted && resolvedTheme && (
                      <div
                        className="site-rounded-full size-4 translate-y-1 bg-(--color)"
                        style={
                          {
                            "--color":
                              theme.cssVars?.[
                                resolvedTheme as "light" | "dark"
                              ]?.["muted-foreground"],
                          } as React.CSSProperties
                        }
                      />
                    )}
                    <div className="flex flex-col justify-start pointer-coarse:gap-1">
                      <div>{theme.title}</div>
                      <div className="pointer-coarse:text-sm text-site-muted-foreground text-xs">
                        Match base color
                      </div>
                    </div>
                  </div>
                </PickerRadioItem>
              ))}
            </PickerGroup>
            <PickerSeparator />
            <PickerGroup>
              {otherThemes.map((theme) => (
                <PickerRadioItem
                  closeOnClick={isMobile}
                  key={theme.name}
                  value={theme.name}
                >
                  <div className="flex items-center gap-2">
                    {mounted && resolvedTheme && (
                      <div
                        className="site-rounded-full size-4 bg-(--color)"
                        style={
                          {
                            "--color":
                              theme.cssVars?.[resolvedTheme as "light" | "dark"]
                                ?.primary,
                          } as React.CSSProperties
                        }
                      />
                    )}
                    {theme.title}
                  </div>
                </PickerRadioItem>
              ))}
            </PickerGroup>
          </PickerRadioGroup>
        </PickerContent>
      </Picker>
      <LockButton
        className="-translate-y-1/2 absolute top-1/2 right-10"
        param="chartColor"
      />
    </div>
  );
}
