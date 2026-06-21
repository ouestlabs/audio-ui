"use client";

import { baseColors } from "@/registry/base-colors";
import { BASE_COLOR_NAMES } from "../lib/search-params";
import { useBuilder } from "./builder-provider";
import { Picker, Swatch } from "./picker";

const titleCase = (value: string) =>
  value.charAt(0).toUpperCase() + value.slice(1);

function swatchColor(name: string) {
  const active = baseColors.find((color) => color.name === name)?.activeColor;
  return active ? `hsl(${active.dark})` : "var(--primary)";
}

export function BaseColorPicker() {
  const { params, setParams } = useBuilder();

  return (
    <Picker
      display={titleCase(params.baseColor)}
      indicator={<Swatch color={swatchColor(params.baseColor)} />}
      label="Base Color"
      onValueChange={(value) => setParams({ baseColor: value })}
      options={BASE_COLOR_NAMES.map((name) => ({
        value: name,
        label: titleCase(name),
        swatch: <Swatch color={swatchColor(name)} />,
      }))}
      value={params.baseColor}
    />
  );
}
