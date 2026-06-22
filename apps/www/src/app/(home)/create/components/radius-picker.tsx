"use client";

import { LockIcon } from "@phosphor-icons/react";
import { RADIUS_CSS, RADIUS_LABELS, RADIUS_VALUES } from "../lib/search-params";
import { useBuilder } from "./builder-provider";
import { Picker } from "./picker";

const RadiusGlyph = ({ radius }: { radius: string }) => (
  <span
    aria-hidden="true"
    className="size-4 shrink-0 border-foreground border-t-2 border-l-2"
    style={{ borderTopLeftRadius: radius }}
  />
);

export function RadiusPicker() {
  const { params, setParams } = useBuilder();
  const isLocked = params.style === "base-lyra";
  const effectiveRadius = isLocked ? "none" : params.radius;

  return (
    <Picker
      disabled={isLocked}
      display={RADIUS_LABELS[effectiveRadius]}
      indicator={
        isLocked ? (
          <LockIcon aria-hidden="true" className="size-4" />
        ) : (
          <RadiusGlyph radius={RADIUS_CSS[params.radius]} />
        )
      }
      label="Radius"
      onValueChange={(value) => setParams({ radius: value })}
      options={RADIUS_VALUES.map((radius) => ({
        value: radius,
        label: RADIUS_LABELS[radius],
      }))}
      value={effectiveRadius}
    />
  );
}
