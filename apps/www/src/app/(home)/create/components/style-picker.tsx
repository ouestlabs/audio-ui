"use client";

import { SquareIcon } from "@phosphor-icons/react";
import { STYLES } from "@/registry/styles";
import { useBuilder } from "./builder-provider";
import { Picker } from "./picker";

const STYLE_LABELS: Record<string, string> = {
  "base-luma": "Luma",
  "base-nova": "Nova",
  "base-vega": "Vega",
  "base-maia": "Maia",
  "base-lyra": "Lyra",
  "base-mira": "Mira",
};

const label = (style: string) => STYLE_LABELS[style] ?? style;

export function StylePicker() {
  const { params, setParams } = useBuilder();

  return (
    <Picker
      display={label(params.style)}
      indicator={<SquareIcon aria-hidden="true" className="size-4" />}
      label="Style"
      onValueChange={(value) => setParams({ style: value })}
      options={STYLES.map((style) => ({ value: style, label: label(style) }))}
      value={params.style}
    />
  );
}
