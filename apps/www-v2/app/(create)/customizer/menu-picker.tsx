"use client";

import { Menu02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useTheme } from "next-themes";
import { useCallback, useEffect, useRef } from "react";
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
import {
  isTranslucentMenuColor,
  useDesignSystemSearchParams,
} from "@/app/(create)/lib/search-params";
import { useConfig } from "@/hooks/use-config";
import { useMounted } from "@/hooks/use-mounted";
import type { MenuColorValue } from "@/registry/config";

// ── Types ──

type ColorChoice = "default" | "inverted";
type SurfaceChoice = "solid" | "translucent";

// ── Helpers ──

function getMenuColorValue(
  color: ColorChoice,
  translucent: boolean
): MenuColorValue {
  if (color === "default") {
    return translucent ? "default-translucent" : "default";
  }
  return translucent ? "inverted-translucent" : "inverted";
}

const MENU_OPTIONS: { value: MenuColorValue; label: string }[] = [
  { value: "default", label: "Default / Solid" },
  { value: "default-translucent", label: "Default / Translucent" },
  { value: "inverted", label: "Inverted / Solid" },
  { value: "inverted-translucent", label: "Inverted / Translucent" },
];

// ── Component ──

export function MenuColorPicker({
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
  const menuColorValue = params.menuColor ?? config.menuColor;
  const isDark = mounted && resolvedTheme === "dark";

  const lastSolidMenuAccentRef = useRef(params.menuAccent);

  const colorChoice: ColorChoice =
    menuColorValue === "inverted" || menuColorValue === "inverted-translucent"
      ? "inverted"
      : "default";

  const surfaceChoice: SurfaceChoice =
    menuColorValue === "default-translucent" ||
    menuColorValue === "inverted-translucent"
      ? "translucent"
      : "solid";

  const currentMenu = MENU_OPTIONS.find((m) => m.value === menuColorValue);

  useEffect(() => {
    if (surfaceChoice === "solid") {
      lastSolidMenuAccentRef.current = params.menuAccent;
    }
  }, [params.menuAccent, surfaceChoice]);

  const setColor = useCallback(
    (color: ColorChoice) => {
      const nextMenuColor = getMenuColorValue(
        color,
        surfaceChoice === "translucent"
      );
      setParams({
        menuColor: nextMenuColor,
        ...(isTranslucentMenuColor(nextMenuColor) && { menuAccent: "subtle" }),
      });
      setConfig((prev) => ({ ...prev, menuColor: nextMenuColor }));
    },
    [surfaceChoice, setParams, setConfig]
  );

  const setSurface = useCallback(
    (choice: SurfaceChoice) => {
      const isTranslucent = choice === "translucent";
      const nextMenuColor = getMenuColorValue(colorChoice, isTranslucent);
      const nextMenuAccent = isTranslucent
        ? "subtle"
        : lastSolidMenuAccentRef.current;
      setParams({
        menuColor: nextMenuColor,
        menuAccent: nextMenuAccent,
      });
      setConfig((prev) => ({
        ...prev,
        menuColor: nextMenuColor,
        menuAccent: nextMenuAccent ?? prev.menuAccent,
      }));
    },
    [colorChoice, setParams, setConfig]
  );

  return (
    <div className="group/picker relative">
      <Picker>
        <PickerTrigger disabled={isDark && colorChoice === "inverted"}>
          <div className="min-w-0 flex-1 pr-10 text-left">
            <div className="text-site-muted-foreground text-xs">Menu</div>
            <div className="truncate font-medium text-site-foreground text-sm">
              {mounted ? currentMenu?.label : "..."}
            </div>
          </div>
          <div className="-translate-y-1/2 pointer-events-none absolute top-1/2 right-4 flex size-4 select-none items-center justify-center text-base text-site-foreground">
            <HugeiconsIcon
              className="size-4"
              icon={Menu02Icon}
              strokeWidth={2}
            />
          </div>
        </PickerTrigger>
        <PickerContent
          align={isMobile ? "center" : "start"}
          anchor={isMobile ? anchorRef : undefined}
          side={isMobile ? "top" : "right"}
        >
          <PickerGroup>
            <PickerLabel>Color</PickerLabel>
            <PickerRadioGroup
              onValueChange={(value) => setColor(value as ColorChoice)}
              value={colorChoice}
            >
              <PickerRadioItem closeOnClick={isMobile} value="default">
                Default
              </PickerRadioItem>
              <PickerRadioItem
                closeOnClick={isMobile}
                disabled={isDark}
                value="inverted"
              >
                Inverted
              </PickerRadioItem>
            </PickerRadioGroup>
          </PickerGroup>
          <PickerSeparator />
          <PickerGroup>
            <PickerLabel>Appearance</PickerLabel>
            <PickerRadioGroup
              onValueChange={(value) => setSurface(value as SurfaceChoice)}
              value={surfaceChoice}
            >
              <PickerRadioItem closeOnClick={isMobile} value="solid">
                Solid
              </PickerRadioItem>
              <PickerRadioItem closeOnClick={isMobile} value="translucent">
                Translucent
              </PickerRadioItem>
            </PickerRadioGroup>
          </PickerGroup>
        </PickerContent>
      </Picker>
      <LockButton
        className="-translate-y-1/2 absolute top-1/2 right-10"
        param="menuColor"
      />
    </div>
  );
}
