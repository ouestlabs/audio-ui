"use client";

import { PaintBrushIcon } from "@phosphor-icons/react";
import { MENU_ACCENT_LABELS, MENU_ACCENT_VALUES } from "../lib/search-params";
import { useBuilder } from "./builder-provider";
import { LockButton } from "./lock-button";
import {
  Picker,
  PickerContent,
  PickerRadioGroup,
  PickerRadioItem,
  PickerTrigger,
} from "./picker";

export function MenuAccentPicker() {
  const { params, setParams } = useBuilder();

  return (
    <div className="group/picker relative">
      <Picker>
        <PickerTrigger>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-muted-foreground text-xs">Menu Accent</span>
            <span className="truncate font-medium text-foreground text-sm">
              {MENU_ACCENT_LABELS[params.menuAccent]}
            </span>
          </span>
          <PaintBrushIcon
            aria-hidden="true"
            className="size-4 shrink-0 text-muted-foreground"
          />
        </PickerTrigger>
        <PickerContent>
          <PickerRadioGroup
            onValueChange={(value) => setParams({ menuAccent: value })}
            value={params.menuAccent}
          >
            {MENU_ACCENT_VALUES.map((value) => (
              <PickerRadioItem key={value} value={value}>
                {MENU_ACCENT_LABELS[value]}
              </PickerRadioItem>
            ))}
          </PickerRadioGroup>
        </PickerContent>
      </Picker>
      <LockButton param="menuAccent" />
    </div>
  );
}
