"use client";

import { SidebarIcon } from "@phosphor-icons/react";
import { MENU_COLOR_LABELS, type MenuColorValue } from "../lib/search-params";
import { useBuilder } from "./builder-provider";
import { LockButton } from "./lock-button";
import {
  Picker,
  PickerContent,
  PickerGroup,
  PickerLabel,
  PickerRadioGroup,
  PickerRadioItem,
  PickerSeparator,
  PickerTrigger,
} from "./picker";

type ColorChoice = "default" | "inverted";
type AppearanceChoice = "solid" | "translucent";

function toMenuColorValue(
  color: ColorChoice,
  appearance: AppearanceChoice
): MenuColorValue {
  if (appearance === "translucent") {
    return color === "inverted"
      ? "inverted-translucent"
      : "default-translucent";
  }
  return color;
}

export function MenuColorPicker() {
  const { params, setParams } = useBuilder();

  const colorChoice: ColorChoice = params.menuColor.startsWith("inverted")
    ? "inverted"
    : "default";
  const appearanceChoice: AppearanceChoice = params.menuColor.endsWith(
    "translucent"
  )
    ? "translucent"
    : "solid";

  return (
    <div className="group/picker relative">
      <Picker>
        <PickerTrigger>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-muted-foreground text-xs">Menu</span>
            <span className="truncate font-medium text-foreground text-sm">
              {MENU_COLOR_LABELS[params.menuColor]}
            </span>
          </span>
          <SidebarIcon
            aria-hidden="true"
            className="size-4 shrink-0 text-muted-foreground"
          />
        </PickerTrigger>
        <PickerContent>
          <PickerGroup>
            <PickerLabel>Color</PickerLabel>
            <PickerRadioGroup
              onValueChange={(value) =>
                setParams({
                  menuColor: toMenuColorValue(
                    value as ColorChoice,
                    appearanceChoice
                  ),
                })
              }
              value={colorChoice}
            >
              <PickerRadioItem value="default">Default</PickerRadioItem>
              <PickerRadioItem value="inverted">Inverted</PickerRadioItem>
            </PickerRadioGroup>
          </PickerGroup>
          <PickerSeparator />
          <PickerGroup>
            <PickerLabel>Appearance</PickerLabel>
            <PickerRadioGroup
              onValueChange={(value) =>
                setParams({
                  menuColor: toMenuColorValue(
                    colorChoice,
                    value as AppearanceChoice
                  ),
                })
              }
              value={appearanceChoice}
            >
              <PickerRadioItem value="solid">Solid</PickerRadioItem>
              <PickerRadioItem value="translucent">Translucent</PickerRadioItem>
            </PickerRadioGroup>
          </PickerGroup>
        </PickerContent>
      </Picker>
      <LockButton param="menuColor" />
    </div>
  );
}
