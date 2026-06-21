"use client";

import { SidebarIcon } from "@phosphor-icons/react";
import { MENU_COLOR_LABELS, MENU_COLOR_VALUES } from "../lib/search-params";
import { useBuilder } from "./builder-provider";
import { Picker } from "./picker";

export function MenuColorPicker() {
  const { params, setParams } = useBuilder();

  return (
    <Picker
      display={MENU_COLOR_LABELS[params.menuColor]}
      indicator={<SidebarIcon aria-hidden="true" className="size-4" />}
      label="Menu"
      onValueChange={(value) => setParams({ menuColor: value })}
      options={MENU_COLOR_VALUES.map((value) => ({
        value,
        label: MENU_COLOR_LABELS[value],
      }))}
      value={params.menuColor}
    />
  );
}
