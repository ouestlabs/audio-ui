"use client";

import { BASE_COLORS } from "@/registry/base-colors";
import { useBuilder } from "./builder-provider";
import { LockButton } from "./lock-button";
import {
  Picker,
  PickerContent,
  PickerRadioGroup,
  PickerRadioItem,
  PickerTrigger,
  Swatch,
} from "./picker";

export function BaseColorPicker() {
  const { params, setParams } = useBuilder();
  const current = BASE_COLORS.find((c) => c.name === params.baseColor);

  return (
    <div className="group/picker relative">
      <Picker>
        <PickerTrigger>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-muted-foreground text-xs">Base Color</span>
            <span className="truncate font-medium text-foreground text-sm">
              {current?.label ?? params.baseColor}
            </span>
          </span>
          <Swatch
            color={
              current?.cssVars.dark?.["muted-foreground"] ?? "var(--primary)"
            }
          />
        </PickerTrigger>
        <PickerContent>
          <PickerRadioGroup
            onValueChange={(value) => setParams({ baseColor: value })}
            value={params.baseColor}
          >
            {BASE_COLORS.map((color) => (
              <PickerRadioItem key={color.name} value={color.name}>
                <Swatch
                  color={
                    color.cssVars.dark?.["muted-foreground"] ?? "var(--primary)"
                  }
                />
                {color.title}
              </PickerRadioItem>
            ))}
          </PickerRadioGroup>
        </PickerContent>
      </Picker>
      <LockButton param="baseColor" />
    </div>
  );
}
