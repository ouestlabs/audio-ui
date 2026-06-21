"use client";

import { Separator } from "@/registry/default/ui/separator";
import { BaseColorPicker } from "./base-color-picker";
import { FontPicker } from "./font-picker";
import { IconLibraryPicker } from "./icon-library-picker";
import { InstallCommand } from "./install-command";
import { ModeSwitcher } from "./mode-switcher";
import { RadiusPicker } from "./radius-picker";
import { StylePicker } from "./style-picker";
import { ThemePicker } from "./theme-picker";

export function Customizer() {
  return (
    <aside className="flex w-full shrink-0 flex-col gap-4 overflow-y-auto rounded-xl border bg-card p-4 md:max-h-full md:w-[--customizer-width]">
      <div className="flex flex-col gap-1">
        <p className="font-semibold text-sm">Design System</p>
        <p className="text-muted-foreground text-xs">
          Customize your audio/ui setup
        </p>
      </div>

      <Separator />

      <StylePicker />
      <Separator />
      <BaseColorPicker />
      <ThemePicker />
      <Separator />
      <RadiusPicker />
      <FontPicker />
      <IconLibraryPicker />
      <Separator />
      <ModeSwitcher />
      <Separator />
      <InstallCommand />
    </aside>
  );
}
