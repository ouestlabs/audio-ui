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
import { BASE_COLORS, type Theme, type ThemeName } from "@/registry/config";

export function ThemePicker({
  themes,
  isMobile,
  anchorRef,
}: {
  themes: readonly Theme[];
  isMobile: boolean;
  anchorRef: React.RefObject<HTMLDivElement | null>;
}) {
  const { resolvedTheme } = useTheme();
  const mounted = useMounted();
  const [params, setParams] = useDesignSystemSearchParams();
  const [config, setConfig] = useConfig();

  const currentTheme = React.useMemo(
    () => themes.find((theme) => theme.name === (params.theme ?? config.theme)),
    [themes, params.theme, config.theme]
  );

  const currentThemeIsBaseColor = React.useMemo(
    () =>
      BASE_COLORS.find(
        (baseColor) => baseColor.name === (params.theme ?? config.theme)
      ),
    [params.theme, config.theme]
  );

  const handleValueChange = React.useCallback(
    (value: string) => {
      const newTheme = value as ThemeName;
      setParams({ theme: newTheme });
      setConfig((prev) => ({ ...prev, theme: newTheme }));
    },
    [setParams, setConfig]
  );

  React.useEffect(() => {
    if (!currentTheme && themes.length > 0) {
      const firstTheme = themes[0].name;
      if (params.theme) {
        setParams({ theme: firstTheme });
      }
      setConfig((prev) => ({ ...prev, theme: firstTheme }));
    }
  }, [currentTheme, themes, setParams, setConfig, params.theme]);

  return (
    <div className="group/picker relative">
      <Picker>
        <PickerTrigger>
          <div className="min-w-0 flex-1 pr-10 text-left">
            <div className="text-site-muted-foreground text-xs">Theme</div>
            <div className="truncate font-medium text-site-foreground text-sm">
              {mounted ? currentTheme?.title : "..."}
            </div>
          </div>
          {mounted && resolvedTheme && (
            <div
              className="site-rounded-full -translate-y-1/2 pointer-events-none absolute top-1/2 right-4 size-4 select-none bg-(--color)"
              style={
                {
                  "--color":
                    currentTheme?.cssVars?.[
                      resolvedTheme as "light" | "dark"
                    ]?.[
                      currentThemeIsBaseColor ? "muted-foreground" : "primary"
                    ],
                } as React.CSSProperties
              }
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
            onValueChange={handleValueChange}
            value={currentTheme?.name}
          >
            <PickerGroup>
              {themes
                .filter((theme) =>
                  BASE_COLORS.find((baseColor) => baseColor.name === theme.name)
                )
                .map((theme) => {
                  const isBaseColor = BASE_COLORS.find(
                    (baseColor) => baseColor.name === theme.name
                  );
                  return (
                    <PickerRadioItem key={theme.name} value={theme.name}>
                      <div className="flex items-start gap-2">
                        {mounted && resolvedTheme && (
                          <div
                            className="site-rounded-full size-4 translate-y-1 bg-(--color)"
                            style={
                              {
                                "--color":
                                  theme.cssVars?.[
                                    resolvedTheme as "light" | "dark"
                                  ]?.[
                                    isBaseColor ? "muted-foreground" : "primary"
                                  ],
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
                  );
                })}
            </PickerGroup>
            <PickerSeparator />
            <PickerGroup>
              {themes
                .filter(
                  (theme) =>
                    !BASE_COLORS.find(
                      (baseColor) => baseColor.name === theme.name
                    )
                )
                .map((theme) => (
                  <PickerRadioItem key={theme.name} value={theme.name}>
                    <div className="flex items-center gap-2">
                      {mounted && resolvedTheme && (
                        <div
                          className="site-rounded-full size-4 bg-(--color)"
                          style={
                            {
                              "--color":
                                theme.cssVars?.[
                                  resolvedTheme as "light" | "dark"
                                ]?.["primary"],
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
        param="theme"
      />
    </div>
  );
}
