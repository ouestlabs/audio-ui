"use client";

import { Separator } from "@/registry/default/ui/separator";
import { LocksProvider } from "../hooks/use-locks";
import { BaseColorPicker } from "./base-color-picker";
import { FontPicker } from "./font-picker";
import { HistoryButtons } from "./history-buttons";
import { IconLibraryPicker } from "./icon-library-picker";
import { MenuAccentPicker } from "./menu-accent-picker";
import { MenuColorPicker } from "./menu-color-picker";
import { ModeSwitcher } from "./mode-switcher";
import { PresetActions } from "./preset-actions";
import { RadiusPicker } from "./radius-picker";
import { ResetButton } from "./reset-button";
import { ShuffleButton } from "./shuffle-button";
import { StylePicker } from "./style-picker";
import { ThemePicker } from "./theme-picker";

export function Customizer() {
  return (
    <LocksProvider>
      <aside className="dark isolate flex w-full shrink-0 flex-col self-start overflow-hidden rounded-2xl bg-card text-card-foreground shadow-xl ring-1 ring-foreground/10 backdrop-blur-xl md:max-h-full md:w-(--customizer-width)">
        <header className="flex shrink-0 items-center justify-between gap-2 border-b px-3 py-2">
          <HistoryButtons />
          <span className="font-medium text-sm">Customize</span>
          <ModeSwitcher />
        </header>

        <div className="no-scrollbar flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3">
          <StylePicker />
          <Separator />
          <BaseColorPicker />
          <ThemePicker />
          <Separator />
          <RadiusPicker />
          <FontPicker label="Heading" param="fontHeading" />
          <FontPicker label="Font" param="font" />
          <IconLibraryPicker />
          <Separator />
          <MenuColorPicker />
          <MenuAccentPicker />
        </div>

        <footer className="flex shrink-0 flex-col gap-2 border-t p-3">
          <PresetActions />
          <div className="flex gap-2">
            <ShuffleButton />
            <ResetButton />
          </div>
        </footer>
      </aside>
    </LocksProvider>
  );
}
