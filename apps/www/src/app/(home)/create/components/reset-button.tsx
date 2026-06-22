"use client";

import { ArrowCounterClockwiseIcon } from "@phosphor-icons/react";
import { Button } from "@/registry/default/ui/button";
import { useBuilder } from "./builder-provider";

// Setting a nuqs param to null removes it from the URL, falling back to its .withDefault() value.
const RESET_ALL = Object.fromEntries(
  [
    "style",
    "theme",
    "baseColor",
    "radius",
    "font",
    "fontHeading",
    "iconLibrary",
    "mode",
    "menuColor",
    "menuAccent",
  ].map((key) => [key, null])
);

export function ResetButton() {
  const { setParams } = useBuilder();
  return (
    <Button
      aria-label="Reset to defaults"
      onClick={() => setParams(RESET_ALL)}
      size="sm"
      variant="ghost"
    >
      <ArrowCounterClockwiseIcon aria-hidden="true" className="size-4" />
      Reset
    </Button>
  );
}
