"use client";

import { THEMES } from "@/lib/themes";
import { useBuilder } from "./builder-provider";
import { LockButton } from "./lock-button";
import { Picker, Swatch } from "./picker";

const swatch = (theme: (typeof THEMES)[number]) => (
  <Swatch color={`hsl(${theme.activeColor.dark})`} />
);

export function ThemePicker() {
  const { params, setParams } = useBuilder();
  const current = THEMES.find((theme) => theme.name === params.theme);

  return (
    <div className="group/picker relative">
      <Picker
        display={current?.label ?? params.theme}
        indicator={current ? swatch(current) : undefined}
        label="Theme"
        onValueChange={(value) => setParams({ theme: value })}
        options={THEMES.map((theme) => ({
          value: theme.name,
          label: theme.label,
          swatch: swatch(theme),
        }))}
        value={params.theme}
      />
      <LockButton param="theme" />
    </div>
  );
}
