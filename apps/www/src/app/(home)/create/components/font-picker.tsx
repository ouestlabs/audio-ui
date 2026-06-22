"use client";

import { TextAaIcon } from "@phosphor-icons/react";
import { useBuilder } from "./builder-provider";
import { LockButton } from "./lock-button";
import {
  Picker,
  PickerContent,
  PickerRadioGroup,
  PickerRadioItem,
  PickerTrigger,
} from "./picker";

const FONT_OPTIONS = [
  { value: "inter", label: "Inter" },
  { value: "geist", label: "Geist" },
  { value: "geist-mono", label: "Geist Mono" },
  { value: "system", label: "System UI" },
] as const;

const labelFor = (value: string) =>
  FONT_OPTIONS.find((font) => font.value === value)?.label ?? "Inter";

export function FontPicker({
  label,
  param,
}: {
  label: string;
  param: "font" | "fontHeading";
}) {
  const { params, setParams } = useBuilder();
  const value = params[param] === "inherit" ? "inter" : params[param];

  return (
    <div className="group/picker relative">
      <Picker>
        <PickerTrigger>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-muted-foreground text-xs">{label}</span>
            <span className="truncate font-medium text-foreground text-sm">
              {labelFor(value)}
            </span>
          </span>
          <TextAaIcon
            aria-hidden="true"
            className="size-4 shrink-0 text-muted-foreground"
          />
        </PickerTrigger>
        <PickerContent>
          <PickerRadioGroup
            onValueChange={(next) =>
              setParams(
                param === "font" ? { font: next } : { fontHeading: next }
              )
            }
            value={value}
          >
            {FONT_OPTIONS.map((font) => (
              <PickerRadioItem key={font.value} value={font.value}>
                {font.label}
              </PickerRadioItem>
            ))}
          </PickerRadioGroup>
        </PickerContent>
      </Picker>
      <LockButton param={param} />
    </div>
  );
}
