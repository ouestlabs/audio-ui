"use client";

import { useTheme } from "next-themes";
import * as React from "react";
import { LockButton } from "@/app/(create)/customizer/lock-button";
import {
  Picker,
  PickerContent,
  PickerGroup,
  PickerItem,
  PickerRadioGroup,
  PickerRadioItem,
  PickerSeparator,
  PickerTrigger,
} from "@/app/(create)/customizer/picker";
import { useDesignSystemSearchParams } from "@/app/(create)/lib/search-params";
import { useConfig } from "@/hooks/use-config";
import { useMounted } from "@/hooks/use-mounted";
import { BASE_COLORS, type BaseColorName } from "@/registry/config";

export function BaseColorPicker({
  isMobile,
  anchorRef,
}: {
  isMobile: boolean;
  anchorRef: React.RefObject<HTMLDivElement | null>;
}) {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useMounted();
  const [params, setParams] = useDesignSystemSearchParams();
  const [config, setConfig] = useConfig();
  const currentBaseColor = React.useMemo(
    () =>
      BASE_COLORS.find(
        (baseColor) => baseColor.name === (params.baseColor ?? config.baseColor)
      ),
    [params.baseColor, config.baseColor]
  );

  const handleValueChange = React.useCallback(
    (value: string) => {
      if (value === "dark") {
        setTheme(resolvedTheme === "dark" ? "light" : "dark");
        return;
      }

      const newBaseColor = value as BaseColorName;
      setParams({ baseColor: newBaseColor });
      setConfig((prev) => ({ ...prev, baseColor: newBaseColor }));
    },
    [setParams, setConfig, setTheme, resolvedTheme]
  );

  return (
    <div className="group/picker relative">
      <Picker>
        <PickerTrigger>
          <div className="flex flex-col justify-start text-left">
            <div className="text-site-muted-foreground text-xs">Base Color</div>
            <div className="font-medium text-site-foreground text-sm">
              {mounted ? currentBaseColor?.title : "..."}
            </div>
          </div>
          {mounted && resolvedTheme && (
            <div
              className="site-rounded-full -translate-y-1/2 pointer-events-none absolute top-1/2 right-4 size-4 select-none bg-(--color)"
              style={
                {
                  "--color":
                    currentBaseColor?.cssVars?.[
                      resolvedTheme as "light" | "dark"
                    ]?.["muted-foreground"],
                } as React.CSSProperties
              }
            />
          )}
        </PickerTrigger>
        <PickerContent
          align={isMobile ? "center" : "start"}
          anchor={isMobile ? anchorRef : undefined}
          side={isMobile ? "top" : "right"}
        >
          <PickerRadioGroup
            onValueChange={handleValueChange}
            value={currentBaseColor?.name}
          >
            <PickerGroup>
              {BASE_COLORS.map((baseColor) => (
                <PickerRadioItem key={baseColor.name} value={baseColor.name}>
                  <div className="flex items-center gap-2">
                    {mounted && resolvedTheme && (
                      <div
                        className="site-rounded-full size-4 bg-(--color)"
                        style={
                          {
                            "--color":
                              baseColor.cssVars?.[
                                resolvedTheme as "light" | "dark"
                              ]?.["muted-foreground"],
                          } as React.CSSProperties
                        }
                      />
                    )}
                    {baseColor.title}
                  </div>
                </PickerRadioItem>
              ))}
            </PickerGroup>
            <PickerSeparator />
            <PickerGroup>
              <PickerItem
                onClick={() => {
                  setTheme(resolvedTheme === "dark" ? "light" : "dark");
                }}
              >
                <div className="flex flex-col justify-start pointer-coarse:gap-1">
                  <div>
                    Switch to {resolvedTheme === "dark" ? "Light" : "Dark"} Mode
                  </div>
                  <div className="pointer-coarse:text-sm text-site-muted-foreground text-xs">
                    Base colors are easier to see in dark mode.
                  </div>
                </div>
              </PickerItem>
            </PickerGroup>
          </PickerRadioGroup>
        </PickerContent>
      </Picker>
      <LockButton
        className="-translate-y-1/2 absolute top-1/2 right-10"
        param="baseColor"
      />
    </div>
  );
}
