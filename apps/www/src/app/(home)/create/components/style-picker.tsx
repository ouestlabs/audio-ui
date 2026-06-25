"use client";

import { cloneElement } from "react";
import { STYLES } from "@/registry/styles";
import { useBuilder } from "./builder-provider";
import {
  Picker,
  PickerContent,
  PickerRadioGroup,
  PickerRadioItem,
  PickerTrigger,
} from "./picker";

export function StylePicker() {
  const { params, setParams } = useBuilder();
  const current = STYLES.find((s) => s.name === params.style) ?? STYLES[0];

  return (
    <Picker>
      <PickerTrigger>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-muted-foreground text-xs">Style</span>
          <span className="truncate font-medium text-foreground text-sm">
            {current.label}
          </span>
        </span>
        {cloneElement(current.icon, {
          className: "size-4 shrink-0 text-muted-foreground",
        })}
      </PickerTrigger>
      <PickerContent>
        <PickerRadioGroup
          onValueChange={(value) => setParams({ style: value })}
          value={params.style}
        >
          {STYLES.map(({ name, label }) => (
            <PickerRadioItem key={name} value={name}>
              {label}
            </PickerRadioItem>
          ))}
        </PickerRadioGroup>
      </PickerContent>
    </Picker>
  );
}
