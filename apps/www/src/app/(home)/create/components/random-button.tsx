"use client";

import { ArrowsClockwiseIcon } from "@phosphor-icons/react";
import { Button } from "@/registry/bases/base/ui/button";
import { STYLES } from "@/registry/styles";
import { THEMES } from "@/registry/themes";
import { useLocks } from "../hooks/use-locks";
import {
  BASE_COLOR_NAMES,
  type BuilderSearchParams,
  MENU_ACCENT_VALUES,
  MENU_COLOR_VALUES,
  RADIUS_VALUES,
} from "../lib/search-params";
import { useBuilder } from "./builder-provider";

const FONT_VALUES = ["inter", "geist", "geist-mono", "system"] as const;
const THEME_NAMES = THEMES.map((t) => t.name);

type ShufflePool = readonly (string | undefined)[];
type ShuffleMap = Partial<Record<keyof BuilderSearchParams, ShufflePool>>;

const SHUFFLE_POOLS: ShuffleMap = {
  style: STYLES.map((s) => s.name),
  baseColor: BASE_COLOR_NAMES,
  theme: THEME_NAMES,
  font: FONT_VALUES,
  menuColor: MENU_COLOR_VALUES,
  menuAccent: MENU_ACCENT_VALUES,
};

function pick<T>(values: readonly T[]): T {
  return values[Math.floor(Math.random() * values.length)] as T;
}

export function RandomButton() {
  const { params, setParams } = useBuilder();
  const { isLocked } = useLocks();

  const shuffle = () => {
    const updates: Partial<BuilderSearchParams> = {};
    for (const [key, pool] of Object.entries(SHUFFLE_POOLS)) {
      const param = key as keyof BuilderSearchParams;
      if (!isLocked(param) && pool) {
        (updates as Record<string, unknown>)[key] = pick(pool);
      }
    }
    // Radius is not in SHUFFLE_POOLS — handle separately so lyra is never randomized.
    const newStyle = (updates.style ?? params.style) as string;
    if (!isLocked("radius") && newStyle !== "base-lyra") {
      updates.radius = pick(RADIUS_VALUES);
    }
    setParams(updates);
  };

  return (
    <Button onClick={shuffle} size="sm" variant="outline">
      <ArrowsClockwiseIcon aria-hidden="true" className="size-4" />
      Shuffle
    </Button>
  );
}
