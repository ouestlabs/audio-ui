"use client";

import { SmileyIcon } from "@phosphor-icons/react";
import { ICON_LIBRARY_VALUES } from "../lib/search-params";
import { useBuilder } from "./builder-provider";
import { Picker } from "./picker";

const ICON_LABELS: Record<string, string> = {
  phosphor: "Phosphor",
};

export function IconLibraryPicker() {
  const { params, setParams } = useBuilder();

  return (
    <Picker
      display={ICON_LABELS[params.iconLibrary] ?? params.iconLibrary}
      indicator={<SmileyIcon aria-hidden="true" className="size-4" />}
      label="Icons"
      onValueChange={(value) => setParams({ iconLibrary: value })}
      options={ICON_LIBRARY_VALUES.map((value) => ({
        value,
        label: ICON_LABELS[value] ?? value,
      }))}
      value={params.iconLibrary}
    />
  );
}
