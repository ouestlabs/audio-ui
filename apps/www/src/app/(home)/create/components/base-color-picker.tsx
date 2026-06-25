"use client";

import { BASE_COLORS } from "@/registry/base-colors";
import {
  BASE_COLOR_NAMES,
  type BuilderSearchParams,
} from "../lib/search-params";
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
            <span className="truncate font-medium text-foreground text-sm capitalize">
              {current?.title ?? params.baseColor}
            </span>
          </span>
          <Swatch color="var(--muted-foreground)" />
        </PickerTrigger>
        <PickerContent>
          <PickerRadioGroup
            onValueChange={(value) => {
              const baseColor = value as BuilderSearchParams["baseColor"];
              if (
                (BASE_COLOR_NAMES as readonly string[]).includes(params.theme)
              ) {
                setParams({ baseColor, theme: baseColor });
              } else {
                setParams({ baseColor });
              }
            }}
            value={params.baseColor}
          >
            {BASE_COLORS.map((color) => (
              <PickerRadioItem key={color.name} value={color.name}>
                <Swatch
                  color={
                    (
                      color.cssVars.dark as Record<string, string> | undefined
                    )?.["muted-foreground"]
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
