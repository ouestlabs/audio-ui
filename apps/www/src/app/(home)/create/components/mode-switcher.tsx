"use client";

import { MoonIcon, SunIcon } from "@phosphor-icons/react";
import { cn } from "@/registry/default/lib/utils";
import { Button } from "@/registry/default/ui/button";
import { useBuilder } from "./builder-provider";

export function ModeSwitcher() {
  const { params, setParams } = useBuilder();
  const isDark = params.mode === "dark";

  return (
    <Button
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className={cn("w-full justify-start gap-2")}
      onClick={() => setParams({ mode: isDark ? "light" : "dark" })}
      variant="outline"
    >
      {isDark ? (
        <SunIcon aria-hidden="true" className="size-4" />
      ) : (
        <MoonIcon aria-hidden="true" className="size-4" />
      )}
      {isDark ? "Light mode" : "Dark mode"}
    </Button>
  );
}
