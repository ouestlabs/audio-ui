"use client";

import { TextAaIcon } from "@phosphor-icons/react";
import { useBuilder } from "./builder-provider";
import { Picker } from "./picker";

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
    <Picker
      display={labelFor(value)}
      indicator={<TextAaIcon aria-hidden="true" className="size-4" />}
      label={label}
      onValueChange={(next) =>
        setParams(param === "font" ? { font: next } : { fontHeading: next })
      }
      options={FONT_OPTIONS.map((font) => ({
        value: font.value,
        label: font.label,
      }))}
      value={value}
    />
  );
}
