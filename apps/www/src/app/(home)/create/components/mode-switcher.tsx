"use client";

import { MoonIcon, SunIcon } from "@phosphor-icons/react";
import { Button } from "@/registry/default/ui/button";
import { useBuilder } from "./builder-provider";

export function ModeSwitcher() {
  const { params, setParams } = useBuilder();
  const isDark = params.mode === "dark";

  return (
    <Button
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      onClick={() => setParams({ mode: isDark ? "light" : "dark" })}
      size="icon-sm"
      variant="ghost"
    >
      {isDark ? (
        <MoonIcon aria-hidden="true" className="size-4" />
      ) : (
        <SunIcon aria-hidden="true" className="size-4" />
      )}
    </Button>
  );
}
