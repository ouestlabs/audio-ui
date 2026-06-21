"use client";

import {
  CircleIcon,
  DiamondIcon,
  DropIcon,
  HexagonIcon,
  type Icon,
  SparkleIcon,
  SquareIcon,
  StarIcon,
  SunIcon,
  WaveformIcon,
} from "@phosphor-icons/react";
import { STYLES } from "@/registry/styles";
import { useBuilder } from "./builder-provider";
import { Picker } from "./picker";

const STYLE_META: Record<string, { label: string; icon: Icon }> = {
  "base-luma": { label: "Luma", icon: SunIcon },
  "base-nova": { label: "Nova", icon: SparkleIcon },
  "base-vega": { label: "Vega", icon: StarIcon },
  "base-maia": { label: "Maia", icon: CircleIcon },
  "base-lyra": { label: "Lyra", icon: WaveformIcon },
  "base-mira": { label: "Mira", icon: HexagonIcon },
  "base-rhea": { label: "Rhea", icon: DiamondIcon },
  "base-sera": { label: "Sera", icon: DropIcon },
};

const meta = (style: string) =>
  STYLE_META[style] ?? { label: style, icon: SquareIcon };

export function StylePicker() {
  const { params, setParams } = useBuilder();
  const CurrentIcon = meta(params.style).icon;

  return (
    <Picker
      display={meta(params.style).label}
      indicator={<CurrentIcon aria-hidden="true" className="size-4" />}
      label="Style"
      onValueChange={(value) => setParams({ style: value })}
      options={STYLES.map((style) => {
        const StyleIcon = meta(style).icon;
        return {
          value: style,
          label: meta(style).label,
          swatch: <StyleIcon aria-hidden="true" className="size-4 shrink-0" />,
        };
      })}
      value={params.style}
    />
  );
}
