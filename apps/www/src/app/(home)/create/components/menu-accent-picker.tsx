"use client";

import { PaintBrushIcon } from "@phosphor-icons/react";
import { MENU_ACCENT_LABELS, MENU_ACCENT_VALUES } from "../lib/search-params";
import { useBuilder } from "./builder-provider";
import { LockButton } from "./lock-button";
import { Picker } from "./picker";

export function MenuAccentPicker() {
  const { params, setParams } = useBuilder();

  return (
    <div className="group/picker relative">
      <Picker
        display={MENU_ACCENT_LABELS[params.menuAccent]}
        indicator={<PaintBrushIcon aria-hidden="true" className="size-4" />}
        label="Menu Accent"
        onValueChange={(value) => setParams({ menuAccent: value })}
        options={MENU_ACCENT_VALUES.map((value) => ({
          value,
          label: MENU_ACCENT_LABELS[value],
        }))}
        value={params.menuAccent}
      />
      <LockButton param="menuAccent" />
    </div>
  );
}
