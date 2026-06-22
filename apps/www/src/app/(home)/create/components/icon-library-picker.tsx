"use client";

import { SmileyIcon } from "@phosphor-icons/react";
import { ICON_LIBRARY_VALUES } from "../lib/search-params";
import { useBuilder } from "./builder-provider";
import {
  Picker,
  PickerContent,
  PickerRadioGroup,
  PickerRadioItem,
  PickerTrigger,
} from "./picker";

const ICON_LABELS: Record<string, string> = {
  phosphor: "Phosphor",
};

export function IconLibraryPicker() {
  const { params, setParams } = useBuilder();

  return (
    <Picker>
      <PickerTrigger>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-muted-foreground text-xs">Icons</span>
          <span className="truncate font-medium text-foreground text-sm">
            {ICON_LABELS[params.iconLibrary] ?? params.iconLibrary}
          </span>
        </span>
        <SmileyIcon
          aria-hidden="true"
          className="size-4 shrink-0 text-muted-foreground"
        />
      </PickerTrigger>
      <PickerContent>
        <PickerRadioGroup
          onValueChange={(value) => setParams({ iconLibrary: value })}
          value={params.iconLibrary}
        >
          {ICON_LIBRARY_VALUES.map((value) => (
            <PickerRadioItem key={value} value={value}>
              {ICON_LABELS[value] ?? value}
            </PickerRadioItem>
          ))}
        </PickerRadioGroup>
      </PickerContent>
    </Picker>
  );
}
