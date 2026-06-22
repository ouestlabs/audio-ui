"use client";

import { LockIcon } from "@phosphor-icons/react";
import { RADIUS_CSS, RADIUS_LABELS, RADIUS_VALUES } from "../lib/search-params";
import { useBuilder } from "./builder-provider";
import {
  Picker,
  PickerContent,
  PickerRadioGroup,
  PickerRadioItem,
  PickerTrigger,
} from "./picker";

function RadiusGlyph({ radius }: { radius: string }) {
  return (
    <span
      aria-hidden="true"
      className="size-4 shrink-0 border-foreground border-t-2 border-l-2"
      style={{ borderTopLeftRadius: radius }}
    />
  );
}

export function RadiusPicker() {
  const { params, setParams } = useBuilder();
  const isLocked = params.style === "base-lyra";
  const effectiveRadius = isLocked ? "none" : params.radius;

  return (
    <Picker>
      <PickerTrigger disabled={isLocked}>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-muted-foreground text-xs">Radius</span>
          <span className="truncate font-medium text-foreground text-sm">
            {RADIUS_LABELS[effectiveRadius]}
          </span>
        </span>
        {isLocked ? (
          <LockIcon
            aria-hidden="true"
            className="size-4 shrink-0 text-muted-foreground"
          />
        ) : (
          <RadiusGlyph radius={RADIUS_CSS[params.radius]} />
        )}
      </PickerTrigger>
      <PickerContent>
        <PickerRadioGroup
          onValueChange={(value) => setParams({ radius: value })}
          value={effectiveRadius}
        >
          {RADIUS_VALUES.map((radius) => (
            <PickerRadioItem key={radius} value={radius}>
              {RADIUS_LABELS[radius]}
            </PickerRadioItem>
          ))}
        </PickerRadioGroup>
      </PickerContent>
    </Picker>
  );
}
