"use client";

import { BASE_COLORS } from "@/registry/base-colors";
import { THEMES } from "@/registry/themes";
import { useBuilder } from "./builder-provider";
import { LockButton } from "./lock-button";
import {
  Picker,
  PickerContent,
  PickerGroup,
  PickerRadioGroup,
  PickerRadioItem,
  PickerSeparator,
  PickerTrigger,
  Swatch,
} from "./picker";

const NEUTRAL_THEME = THEMES.find((theme) => theme.name === "neutral");
const BASE_COLOR_NAMES = new Set(BASE_COLORS.map((c) => c.name));
const ACCENT_THEMES = THEMES.filter(
  (theme) => !BASE_COLOR_NAMES.has(theme.name)
);

export function ThemePicker() {
  const { params, setParams } = useBuilder();
  const current = THEMES.find((theme) => theme.name === params.theme);
  const themeIsBaseColor = BASE_COLOR_NAMES.has(params.theme as never);

  return (
    <div className="group/picker relative">
      <Picker>
        <PickerTrigger>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-muted-foreground text-xs">Theme</span>
            <span className="truncate font-medium text-foreground text-sm">
              {current?.title ?? params.theme}
            </span>
          </span>
          <Swatch
            color={
              themeIsBaseColor ? "var(--muted-foreground)" : "var(--primary)"
            }
          />
        </PickerTrigger>
        <PickerContent className="max-h-96">
          <PickerRadioGroup
            onValueChange={(value) => setParams({ theme: value })}
            value={params.theme}
          >
            {NEUTRAL_THEME && (
              <PickerGroup>
                <PickerRadioItem value={NEUTRAL_THEME.name}>
                  <Swatch
                    color={
                      NEUTRAL_THEME.cssVars.dark?.primary ??
                      NEUTRAL_THEME.cssVars.light?.primary
                    }
                  />
                  {NEUTRAL_THEME.title}
                </PickerRadioItem>
              </PickerGroup>
            )}
            <PickerSeparator />
            <PickerGroup>
              {ACCENT_THEMES.map((theme) => (
                <PickerRadioItem key={theme.name} value={theme.name}>
                  <Swatch
                    color={
                      theme.cssVars.dark?.primary ??
                      theme.cssVars.light?.primary
                    }
                  />
                  {theme.title}
                </PickerRadioItem>
              ))}
            </PickerGroup>
          </PickerRadioGroup>
        </PickerContent>
      </Picker>
      <LockButton param="theme" />
    </div>
  );
}
